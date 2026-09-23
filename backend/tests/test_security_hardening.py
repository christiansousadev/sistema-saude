"""
testes de borda de segurança: rate limiting, reuso de refresh token,
isolamento idor entre usuários e permissão de rotas de superadmin.
"""
from datetime import datetime, timezone

from app.core.limiter import limiter
from app.core.security import create_short_access_token, hash_password
from app.db.models import User


def _cookie_header(email: str) -> dict:
    token = create_short_access_token(email)
    return {"Cookie": f"ss_access_token={token}; ss_session_exp=9999999999"}


def test_login_rate_limit_blocks_after_threshold(client, test_user):
    payload = {"email": test_user.email, "password": "SenhaErrada!"}
    try:
        # dispara mais chamadas do que o limite de 10/minuto — a última precisa vir bloqueada
        # independente de quanto da cota outros testes já tenham consumido nesta execução
        responses = [client.post("/api/v1/auth/login", json=payload) for _ in range(12)]
        assert responses[-1].status_code == 429
    finally:
        # o limiter usa armazenamento em memória compartilhado entre testes — sem isso,
        # a cota estourada aqui vazaria e derrubaria o login dos testes seguintes
        limiter.reset()


def test_refresh_token_reuse_after_rotation_is_rejected(client, test_user):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "SenhaForte123!"},
    )
    old_refresh = login_res.cookies["ss_refresh_token"]

    # primeira rotação — sucede e invalida o token antigo
    client.cookies.set("ss_refresh_token", old_refresh, path="/api/v1/auth/refresh")
    first_res = client.post("/api/v1/auth/refresh")
    assert first_res.status_code == 200
    assert first_res.cookies.get("ss_refresh_token") != old_refresh

    # reapresenta o token antigo (já rotacionado) — ataque de reuso deve ser rejeitado
    client.cookies.set("ss_refresh_token", old_refresh, path="/api/v1/auth/refresh")
    reuse_res = client.post("/api/v1/auth/refresh")
    assert reuse_res.status_code == 401


def test_physical_record_isolated_between_users(client, db_session, test_user):
    other_user = User(
        name="Outro Usuário",
        email="outro.usuario@exemplo.com",
        hashed_password=hash_password("OutraSenha123!"),
        is_active=True,
        is_superadmin=False,
    )
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    owner_headers = _cookie_header(test_user.email)
    other_headers = _cookie_header(other_user.email)

    create_res = client.post(
        "/api/v1/physical/",
        data={"recorded_at": datetime.now(timezone.utc).isoformat(), "weight_kg": "70.0"},
        headers=owner_headers,
    )
    assert create_res.status_code == 201
    record_id = create_res.json()["id"]

    # outro usuário tenta ler o registro — tratado como inexistente, nunca 403 (evita
    # confirmar a existência do id para quem não é dono)
    forbidden_res = client.get(f"/api/v1/physical/{record_id}", headers=other_headers)
    assert forbidden_res.status_code == 404

    # o dono continua enxergando o próprio registro normalmente
    owner_res = client.get(f"/api/v1/physical/{record_id}", headers=owner_headers)
    assert owner_res.status_code == 200


def test_admin_users_endpoint_requires_superadmin(client, db_session, auth_headers):
    # usuário comum não pode listar usuários da plataforma
    forbidden_res = client.get("/api/v1/admin/users/", headers=auth_headers)
    assert forbidden_res.status_code == 403

    admin_user = User(
        name="Admin Sistema",
        email="admin.sistema@exemplo.com",
        hashed_password=hash_password("SenhaForte123!"),
        is_active=True,
        is_superadmin=True,
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    admin_res = client.get("/api/v1/admin/users/", headers=_cookie_header(admin_user.email))
    assert admin_res.status_code == 200
    assert isinstance(admin_res.json(), list)
