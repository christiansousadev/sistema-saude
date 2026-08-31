from datetime import datetime, timezone
from app.db.models import ClinicalTest, PhysicalEvolution


def test_medical_summary_report(client, auth_headers, test_user, db_session):
    # Adiciona medição física
    p = PhysicalEvolution(
        user_id=test_user.id,
        recorded_at=datetime.now(timezone.utc),
        weight_kg=80.0,
        body_fat_pct=20.0,
        muscle_mass_kg=35.0,
    )
    db_session.add(p)

    # Adiciona exame clínico
    c = ClinicalTest(
        user_id=test_user.id,
        recorded_at=datetime.now(timezone.utc),
        extracted_data={
            "markers": [
                {
                    "name": "Colesterol Total",
                    "value": "190",
                    "unit": "mg/dL",
                    "status": "normal",
                }
            ]
        },
        is_validated=True,
    )
    db_session.add(c)
    db_session.commit()

    # Chama endpoint de relatório
    res = client.get("/api/v1/reports/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["patient"]["name"] == test_user.name
    assert data["physical"]["latest_weight_kg"] == 80.0
    assert data["physical"]["latest_imc"] is not None
    assert data["clinical"]["total_exams"] == 1
    assert len(data["clinical"]["latest_markers"]) == 1


def test_assistant_chat_endpoint(client, auth_headers):
    payload = {
        "message": "Como estão meus níveis de colesterol e meu peso?",
        "conversation_history": [],
    }
    res = client.post("/api/v1/assistant/chat", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "disclaimer" in data
