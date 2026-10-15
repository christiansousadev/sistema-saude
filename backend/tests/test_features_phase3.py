import io
import json
import zipfile
from datetime import datetime, timezone
import pytest


def test_medication_crud_flow(client, auth_headers):
    # 1. cria medicamento
    payload = {
        "name": "Coenzima Q10",
        "dosage": "100mg",
        "frequency": "1x ao dia pela manha",
        "category": "suplemento",
        "instructions": "Tomar apos o cafe",
        "is_active": True,
    }
    create_res = client.post("/api/v1/medications", json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    med_data = create_res.json()
    assert med_data["name"] == "Coenzima Q10"
    assert med_data["category"] == "suplemento"
    med_id = med_data["id"]

    # 2. lista medicamentos
    list_res = client.get("/api/v1/medications", headers=auth_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(item["id"] == med_id for item in list_data["items"])

    # 3. busca por id
    get_res = client.get(f"/api/v1/medications/{med_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Coenzima Q10"

    # 4. atualiza dosagem
    update_res = client.put(
        f"/api/v1/medications/{med_id}",
        json={"dosage": "200mg", "instructions": "Tomar apos o almoço"},
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["dosage"] == "200mg"

    # 5. remove medicamento
    del_res = client.delete(f"/api/v1/medications/{med_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # 6. verifica que nao existe mais
    get_after_del = client.get(f"/api/v1/medications/{med_id}", headers=auth_headers)
    assert get_after_del.status_code == 404


def test_doctor_share_token_and_public_access(client, auth_headers):
    # 1. gera link de compartilhamento
    share_payload = {
        "recipient_name": "Dr. Fernando Cardiologista",
        "expires_in_hours": 72,
    }
    gen_res = client.post("/api/v1/doctor-share/generate", json=share_payload, headers=auth_headers)
    assert gen_res.status_code == 201
    share_data = gen_res.json()
    token = share_data["token"]
    token_id = share_data["id"]
    assert share_data["recipient_name"] == "Dr. Fernando Cardiologista"
    assert share_data["is_active"] is True
    assert share_data["access_count"] == 0

    # 2. lista tokens do paciente
    list_res = client.get("/api/v1/doctor-share/tokens", headers=auth_headers)
    assert list_res.status_code == 200
    assert any(t["id"] == token_id for t in list_res.json()["items"])

    # 3. acesso publico sem credenciais / cookies de autenticacao
    pub_res = client.get(f"/api/v1/public/reports/share/{token}")
    assert pub_res.status_code == 200
    report_data = pub_res.json()
    assert "patient" in report_data
    assert "physical" in report_data
    assert "clinical" in report_data

    # 4. revoga token
    revoke_res = client.post(f"/api/v1/doctor-share/tokens/{token_id}/revoke", headers=auth_headers)
    assert revoke_res.status_code == 200
    assert revoke_res.json()["is_active"] is False

    # 5. acesso publico apos revogacao deve ser negado (404)
    pub_revoked = client.get(f"/api/v1/public/reports/share/{token}")
    assert pub_revoked.status_code == 404


def test_lgpd_data_export(client, auth_headers):
    # requisita exportacao completa dos dados
    export_res = client.get("/api/v1/export/patient-data", headers=auth_headers)
    assert export_res.status_code == 200
    assert export_res.headers.get("content-type") == "application/zip"
    assert "attachment" in export_res.headers.get("content-disposition", "")

    # le o zip em memoria
    with zipfile.ZipFile(io.BytesIO(export_res.content), "r") as zf:
        namelist = zf.namelist()
        assert "perfil_paciente.json" in namelist
        assert "historico_fisico.csv" in namelist
        assert "historico_clinico_biomarcadores.csv" in namelist
        assert "habitos_diarios.csv" in namelist
        assert "medicamentos_suplementos.csv" in namelist
        assert "TERMO_PORTABILIDADE_LGPD.txt" in namelist

        # valida o conteudo do perfil
        profile_bytes = zf.read("perfil_paciente.json")
        profile = json.loads(profile_bytes.decode("utf-8"))
        assert "email" in profile
        assert "lgpd_compliance" in profile
