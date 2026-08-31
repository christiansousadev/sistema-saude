from datetime import datetime, timezone


def test_create_and_list_physical(client, auth_headers, test_user):
    # Cria registro físico
    form_data = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "weight_kg": "78.5",
        "body_fat_pct": "18.2",
        "muscle_mass_kg": "36.0",
        "notes": "Treino forte esta semana",
    }
    create_res = client.post("/api/v1/physical/", data=form_data, headers=auth_headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["weight_kg"] == 78.5
    assert created_data["user_id"] == test_user.id
    record_id = created_data["id"]

    # Busca por ID
    get_res = client.get(f"/api/v1/physical/{record_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == record_id

    # Lista registros
    list_res = client.get("/api/v1/physical/", headers=auth_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(r["id"] == record_id for r in list_data["items"])

    # Deleta registro
    del_res = client.delete(f"/api/v1/physical/{record_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # Confirma remoção
    get_again = client.get(f"/api/v1/physical/{record_id}", headers=auth_headers)
    assert get_again.status_code == 404
