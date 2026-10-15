from datetime import datetime, timezone
import pytest
from app.db.models import ClinicalTest


def test_water_habit_increment_and_history(client, auth_headers):
    # incrementa agua hoje
    res1 = client.post("/api/v1/habits/water/increment", json={"increment_ml": 250}, headers=auth_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["water_ml"] == 250
    assert data1["pct"] == 10

    # incrementa mais 500ml
    res2 = client.post("/api/v1/habits/water/increment", json={"increment_ml": 500}, headers=auth_headers)
    assert res2.status_code == 200
    assert res2.json()["water_ml"] == 750

    # busca historico
    res_hist = client.get("/api/v1/habits/water/history?days=7", headers=auth_headers)
    assert res_hist.status_code == 200
    hist_data = res_hist.json()
    assert len(hist_data["items"]) == 7
    assert hist_data["days_logged"] == 1
    assert hist_data["average_ml"] == 750.0

    # reseta agua do dia
    res_reset = client.post("/api/v1/habits/water/reset", headers=auth_headers)
    assert res_reset.status_code == 200
    assert res_reset.json()["water_ml"] == 0


def test_physical_circumferences_and_cardiovascular_risk(client, auth_headers):
    # cria registro fisico com circunferencias
    # altura do test_user na fixture e 180cm
    # waist = 90cm -> waist_to_height = 90/180 = 0.50 -> moderado
    # hip = 100cm -> waist_to_hip = 90/100 = 0.90
    res = client.post(
        "/api/v1/physical/",
        data={
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "weight_kg": 80.0,
            "waist_cm": 90.0,
            "hip_cm": 100.0,
            "chest_cm": 102.0,
            "arm_cm": 36.0,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["waist_cm"] == 90.0
    assert data["hip_cm"] == 100.0
    assert data["waist_to_hip_ratio"] == 0.90
    assert data["waist_to_height_ratio"] == 0.50
    assert data["cardiovascular_risk"] == "moderado"


def test_clinical_biomarkers_timeline(client, auth_headers, test_user, db_session):
    # cria dois exames diretamente no banco com marcadores
    test1 = ClinicalTest(
        user_id=test_user.id,
        recorded_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        extracted_data={
            "engine": "manual",
            "status": "completed",
            "markers": [
                {"name": "Glicemia em Jejum", "value": "95", "unit": "mg/dL", "reference_range": "70 – 99", "status": "normal"},
                {"name": "Vitamina D", "value": 24.5, "unit": "ng/mL", "reference_range": "30 – 100", "status": "baixo"},
            ],
        },
        is_validated=True,
    )
    test2 = ClinicalTest(
        user_id=test_user.id,
        recorded_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
        extracted_data={
            "engine": "manual",
            "status": "completed",
            "markers": [
                {"name": "Glicemia em Jejum", "value": 89.0, "unit": "mg/dL", "reference_range": "70 – 99", "status": "normal"},
                {"name": "Vitamina D", "value": 38.0, "unit": "ng/mL", "reference_range": "30 – 100", "status": "normal"},
            ],
        },
        is_validated=True,
    )
    db_session.add(test1)
    db_session.add(test2)
    db_session.commit()

    res = client.get("/api/v1/clinical/biomarkers/timeline", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    biomarkers = data["biomarkers"]
    assert len(biomarkers) == 2

    # acha glicemia
    glicose = next(b for b in biomarkers if b["name"] == "Glicemia em Jejum")
    assert glicose["category"] == "Glicemia"
    assert len(glicose["data_points"]) == 2
    assert glicose["latest_value"] == 89.0
    assert glicose["data_points"][0]["value"] == 95.0
    assert glicose["data_points"][1]["value"] == 89.0

    # acha vitamina d
    vit_d = next(b for b in biomarkers if b["name"] == "Vitamina D")
    assert vit_d["category"] == "Vitaminas e Minerais"
    assert vit_d["latest_value"] == 38.0
    assert vit_d["latest_status"] == "normal"
