from datetime import datetime, timezone


def test_create_and_patch_clinical(client, auth_headers, test_user):
    # 1. Cria exame clínico (inicia não validado)
    form_data = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "notes": "Exame de rotina anual",
    }
    create_res = client.post("/api/v1/clinical/", data=form_data, headers=auth_headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["is_validated"] is False
    record_id = created_data["id"]

    # 2. Confirma dados e marcadores via PATCH (human-in-the-loop)
    patch_payload = {
        "extracted_data": {
            "engine": "local_cv",
            "status": "manual",
            "markers": [
                {
                    "name": "Glicemia em Jejum",
                    "value": "89.0",
                    "unit": "mg/dL",
                    "reference_range": "70 - 99",
                    "status": "normal",
                },
                {
                    "name": "Colesterol Total",
                    "value": "185.0",
                    "unit": "mg/dL",
                    "reference_range": "< 200",
                    "status": "normal",
                },
            ],
        },
        "notes": "Marcadores conferidos com o laudo original",
    }
    patch_res = client.patch(
        f"/api/v1/clinical/{record_id}/data",
        json=patch_payload,
        headers=auth_headers,
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert patched_data["is_validated"] is True
    assert len(patched_data["extracted_data"]["markers"]) == 2

    # 3. Lista exames
    list_res = client.get("/api/v1/clinical/", headers=auth_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 4. Deleta exame
    del_res = client.delete(f"/api/v1/clinical/{record_id}", headers=auth_headers)
    assert del_res.status_code == 204
