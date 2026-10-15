from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ClinicalTest, Medication, PhysicalEvolution, User
from app.schemas.reports import (
    ClinicalSummaryReport,
    MedicalSummaryResponse,
    PatientProfileSummary,
    PhysicalSummaryReport,
)
from app.services.biomarker_trends import calculate_biomarker_trends
from app.services.medication_interactions import analyze_medication_biomarker_interactions


def _calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def _classify_imc(imc: float | None) -> str | None:
    if imc is None:
        return None
    if imc < 18.5:
        return "Abaixo do peso"
    if imc < 25.0:
        return "Peso ideal"
    if imc < 30.0:
        return "Sobrepeso"
    if imc < 35.0:
        return "Obesidade Grau I"
    if imc < 40.0:
        return "Obesidade Grau II"
    return "Obesidade Grau III"


# CONSOLIDA RELATORIO MEDICO A PARTIR DE DADOS CLINICOS E FISICOS
def build_medical_summary(user: User, db: Session) -> MedicalSummaryResponse:
    # 1. perfil do paciente
    patient_summary = PatientProfileSummary(
        name=user.name,
        email=user.email,
        height_cm=user.height_cm,
        birth_date=user.birth_date,
        age=_calculate_age(user.birth_date),
        created_at=user.created_at,
    )

    # 2. registros fisicos
    physical_base_q = db.query(PhysicalEvolution).filter(
        PhysicalEvolution.user_id == user.id
    )
    total_physicals = physical_base_q.count()
    first_rec = physical_base_q.order_by(PhysicalEvolution.recorded_at.asc()).first()
    latest_rec = (
        physical_base_q.order_by(PhysicalEvolution.recorded_at.desc()).first()
        if total_physicals > 1
        else first_rec
    )

    latest_imc = None
    if latest_rec and latest_rec.weight_kg and user.height_cm:
        height_m = user.height_cm / 100.0
        latest_imc = round(latest_rec.weight_kg / (height_m * height_m), 1)

    delta_weight = None
    if first_rec and latest_rec and first_rec.weight_kg and latest_rec.weight_kg:
        delta_weight = round(latest_rec.weight_kg - first_rec.weight_kg, 1)

    delta_fat = None
    if first_rec and latest_rec and first_rec.body_fat_pct and latest_rec.body_fat_pct:
        delta_fat = round(latest_rec.body_fat_pct - first_rec.body_fat_pct, 1)

    physical_summary = PhysicalSummaryReport(
        total_records=total_physicals,
        first_record_date=first_rec.recorded_at if first_rec else None,
        latest_record_date=latest_rec.recorded_at if latest_rec else None,
        first_weight_kg=first_rec.weight_kg if first_rec else None,
        latest_weight_kg=latest_rec.weight_kg if latest_rec else None,
        delta_weight_kg=delta_weight,
        first_body_fat_pct=first_rec.body_fat_pct if first_rec else None,
        latest_body_fat_pct=latest_rec.body_fat_pct if latest_rec else None,
        delta_body_fat_pct=delta_fat,
        latest_muscle_mass_kg=latest_rec.muscle_mass_kg if latest_rec else None,
        latest_imc=latest_imc,
        imc_classification=_classify_imc(latest_imc),
        latest_ai_analysis=latest_rec.ai_analysis if latest_rec else None,
    )

    # 3. registros clinicos
    clinical_base_q = db.query(ClinicalTest).filter(ClinicalTest.user_id == user.id)
    total_exams = clinical_base_q.count()
    validated_count = clinical_base_q.filter(ClinicalTest.is_validated.is_(True)).count()

    latest_two = (
        clinical_base_q.order_by(ClinicalTest.recorded_at.desc()).limit(2).all()
    )
    latest_clinical = latest_two[0] if latest_two else None
    prev_clinical = latest_two[1] if len(latest_two) > 1 else None

    latest_markers_raw = (
        latest_clinical.extracted_data.get("markers", [])
        if latest_clinical and latest_clinical.extracted_data
        else []
    )
    prev_markers_raw = (
        prev_clinical.extracted_data.get("markers", [])
        if prev_clinical and prev_clinical.extracted_data
        else []
    )

    enriched_markers = calculate_biomarker_trends(latest_markers_raw, prev_markers_raw)

    alerts: list[dict[str, Any]] = []
    for m in enriched_markers:
        if m.get("status") in ("alto", "baixo"):
            alerts.append({
                "marker": m.get("name"),
                "value": f"{m.get('value')} {m.get('unit')}",
                "status": m.get("status"),
                "message": f"Valor {m.get('status')} em relacao a faixa de referencia ({m.get('reference_range') or 'padrao'}).",
            })
        elif m.get("alert"):
            alerts.append({
                "marker": m.get("name"),
                "value": f"{m.get('value')} {m.get('unit')}",
                "status": m.get("trend"),
                "message": m.get("alert"),
            })

    # cruzamento com medicamentos e suplementos ativos
    medications = (
        db.query(Medication)
        .filter(Medication.user_id == user.id, Medication.is_active.is_(True))
        .all()
    )
    med_alerts = analyze_medication_biomarker_interactions(enriched_markers, medications)
    for ma in med_alerts:
        alerts.append({
            "marker": f"{ma['marker']} ({ma['medication']})",
            "value": "Contexto Farmacológico",
            "status": ma["severity"],
            "message": ma["message"],
        })

    clinical_summary = ClinicalSummaryReport(
        total_exams=total_exams,
        latest_exam_date=latest_clinical.recorded_at if latest_clinical else None,
        latest_markers=enriched_markers,
        active_alerts=alerts,
        validated_exams_count=validated_count,
    )

    return MedicalSummaryResponse(
        generated_at=datetime.now(timezone.utc),
        patient=patient_summary,
        physical=physical_summary,
        clinical=clinical_summary,
    )
