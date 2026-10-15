from datetime import datetime, timezone
import pyotp
import pytest
from app.db.models import ClinicalTest, Medication


def test_doctor_share_pin_protection(client, auth_headers):
    # 1. gera link com pin de seguranca
    res = client.post(
        "/api/v1/doctor-share/generate",
        json={"recipient_name": "Dra. Ana", "expires_in_hours": 48, "pin": "5432"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    token = res.json()["token"]
    assert res.json()["has_pin"] is True

    # 2. pre-check informa que exige pin
    check_res = client.get(f"/api/v1/public/reports/share/{token}/check")
    assert check_res.status_code == 200
    assert check_res.json()["requires_pin"] is True

    # 3. acesso sem pin e bloqueado com 401 pin_required
    no_pin_res = client.get(f"/api/v1/public/reports/share/{token}")
    assert no_pin_res.status_code == 401
    assert no_pin_res.json()["detail"] == "pin_required"

    # 4. acesso com pin incorreto e bloqueado com 401 pin_invalid
    wrong_pin_res = client.get(f"/api/v1/public/reports/share/{token}?pin=0000")
    assert wrong_pin_res.status_code == 401
    assert wrong_pin_res.json()["detail"] == "pin_invalid"

    # 5. acesso com pin correto e liberado (200)
    ok_res = client.get(f"/api/v1/public/reports/share/{token}?pin=5432")
    assert ok_res.status_code == 200
    assert "patient" in ok_res.json()


def test_medication_biomarker_interaction_alerts(client, auth_headers, test_user, db_session):
    # 1. cadastra suplemento de creatina
    med = Medication(
        user_id=test_user.id,
        name="Creatina Monohidratada",
        dosage="5g",
        frequency="1x ao dia",
        category="suplemento",
        is_active=True,
    )
    db_session.add(med)

    # 2. cadastra exame com creatinina
    test_record = ClinicalTest(
        user_id=test_user.id,
        recorded_at=datetime.now(timezone.utc),
        notes="Perfil Renal",
        is_validated=True,
        extracted_data={
            "markers": [
                {
                    "name": "Creatinina",
                    "value": 1.35,
                    "unit": "mg/dL",
                    "reference_range": "0.7 - 1.2",
                    "status": "alto",
                }
            ]
        },
    )
    db_session.add(test_record)
    db_session.commit()

    # 3. verifica alerta farmacologico no relatorio medico
    summary_res = client.get("/api/v1/reports/summary", headers=auth_headers)
    assert summary_res.status_code == 200
    alerts = summary_res.json()["clinical"]["active_alerts"]
    assert any("Creatina" in a["marker"] for a in alerts)

    # 4. verifica pergunta gerada no assistente
    questions_res = client.get("/api/v1/assistant/doctor-questions", headers=auth_headers)
    assert questions_res.status_code == 200
    questions = questions_res.json()["questions"]
    assert any("Creatina" in q for q in questions)


def test_2fa_totp_setup_and_login_flow(client, auth_headers, test_user):
    # 1. inicia setup de 2fa
    setup_res = client.post("/api/v1/auth/2fa/setup", headers=auth_headers)
    assert setup_res.status_code == 200
    setup_data = setup_res.json()
    secret = setup_data["secret"]
    assert "otpauth://" in setup_data["otpauth_url"]

    # 2. tenta validar com codigo invalido
    bad_verify = client.post("/api/v1/auth/2fa/verify", json={"code": "000000"}, headers=auth_headers)
    assert bad_verify.status_code == 400

    # 3. valida com codigo valido
    valid_code = pyotp.TOTP(secret).now()
    good_verify = client.post("/api/v1/auth/2fa/verify", json={"code": valid_code}, headers=auth_headers)
    assert good_verify.status_code == 200
    assert good_verify.json()["is_totp_enabled"] is True

    # 4. login sem codigo 2fa deve exigir totp (403 totp_required)
    login_no_totp = client.post("/api/v1/auth/login", json={"email": test_user.email, "password": "SenhaForte123!"})
    assert login_no_totp.status_code == 403
    assert login_no_totp.json()["detail"] == "totp_required"

    # 5. login com codigo 2fa valido tem sucesso (200)
    current_code = pyotp.TOTP(secret).now()
    login_with_totp = client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "SenhaForte123!", "totp_code": current_code},
    )
    assert login_with_totp.status_code == 200

    # 6. desativa 2fa
    disable_code = pyotp.TOTP(secret).now()
    disable_res = client.post("/api/v1/auth/2fa/disable", json={"code": disable_code}, headers=auth_headers)
    assert disable_res.status_code == 200
    assert disable_res.json()["is_totp_enabled"] is False
