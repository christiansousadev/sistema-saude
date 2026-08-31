def test_register_user_success(client):
    payload = {
        "name": "Maria Oliveira",
        "email": "maria@teste.com",
        "password": "SenhaForte123!",
        "height_cm": 165.0,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "maria@teste.com"
    assert data["name"] == "Maria Oliveira"
    assert "id" in data


def test_register_user_duplicate_email(client, test_user):
    payload = {
        "name": "Outro Nome",
        "email": test_user.email,
        "password": "SenhaForte123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


def test_register_weak_password(client):
    payload = {
        "name": "User",
        "email": "weak@teste.com",
        "password": "fraca",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_login_success(client, test_user):
    payload = {
        "email": test_user.email,
        "password": "SenhaForte123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    assert "ss_access_token" in response.cookies
    assert "ss_refresh_token" in response.cookies
    assert "ss_session_exp" in response.cookies


def test_login_invalid_password(client, test_user):
    payload = {
        "email": test_user.email,
        "password": "SenhaIncorreta!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401


def test_auth_me_endpoint(client, auth_headers, test_user):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email


def test_auth_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_refresh_token_rotation_flow(client, test_user):
    # 1. Login para obter cookies
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "SenhaForte123!"},
    )
    refresh_token = login_res.cookies["ss_refresh_token"]

    # 2. Chama /refresh enviando o cookie
    client.cookies.set("ss_refresh_token", refresh_token, path="/api/v1/auth/refresh")
    refresh_res = client.post("/api/v1/auth/refresh")

    assert refresh_res.status_code == 200
    new_refresh_token = refresh_res.cookies.get("ss_refresh_token")
    assert new_refresh_token is not None
    assert new_refresh_token != refresh_token


def test_logout_clears_cookies(client, auth_headers):
    response = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert response.status_code == 200
