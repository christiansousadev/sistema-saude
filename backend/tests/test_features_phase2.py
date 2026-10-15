from datetime import datetime, timezone
from app.db.models import ClinicalTest, PhysicalEvolution, DailyHabit


def test_executive_summary_and_doctor_questions_endpoints(client, auth_headers, test_user, db_session):
    # cria registros para contexto completo
    p = PhysicalEvolution(
        user_id=test_user.id,
        recorded_at=datetime.now(timezone.utc),
        weight_kg=82.0,
        waist_cm=88.0,
        body_fat_pct=19.0,
    )
    c = ClinicalTest(
        user_id=test_user.id,
        recorded_at=datetime.now(timezone.utc),
        extracted_data={
            "engine": "manual",
            "status": "completed",
            "markers": [
                {"name": "Glicemia em Jejum", "value": 110.0, "unit": "mg/dL", "status": "alto"},
                {"name": "Colesterol Total", "value": 180.0, "unit": "mg/dL", "status": "normal"},
            ],
        },
        is_validated=True,
    )
    h = DailyHabit(
        user_id=test_user.id,
        date=datetime.now(timezone.utc).date(),
        water_ml=2600,
        water_goal_ml=2500,
    )
    db_session.add_all([p, c, h])
    db_session.commit()

    # testa executive-summary
    res_exec = client.get("/api/v1/assistant/executive-summary", headers=auth_headers)
    assert res_exec.status_code == 200
    exec_data = res_exec.json()
    assert "summary_headline" in exec_data
    assert exec_data["overall_status"] == "atencao"
    assert "Glicemia em Jejum" in exec_data["clinical_insights"]
    assert len(exec_data["action_plan"]) >= 2

    # testa doctor-questions
    res_q = client.get("/api/v1/assistant/doctor-questions", headers=auth_headers)
    assert res_q.status_code == 200
    q_data = res_q.json()
    assert len(q_data["questions"]) >= 1
    assert "Glicemia em Jejum" in q_data["abnormal_markers_found"]
    assert any("glicem" in q.lower() for q in q_data["questions"])
