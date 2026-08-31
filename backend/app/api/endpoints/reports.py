import logging
from datetime import date, datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.db.models import ClinicalTest, PhysicalEvolution
from app.db.session import get_db
from app.schemas.reports import (
    ClinicalSummaryReport,
    MedicalSummaryResponse,
    PatientProfileSummary,
    PhysicalSummaryReport,
)
from app.services.biomarker_trends import calculate_biomarker_trends

logger = logging.getLogger("audit.clinical")

router = APIRouter(prefix="/reports", tags=["reports"])


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


@router.get("/summary", response_model=MedicalSummaryResponse)
def get_medical_summary(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retorna o consolidado completo de saúde do usuário:
    - Perfil do paciente e idade calculada
    - Resumo de evolução física (pesos inicial e atual, deltas, IMC, última análise IA)
    - Resumo de exames clínicos mais recentes com tendências de biomarcadores e alertas
    """
    try:
        # 1. Perfil do paciente
        patient_summary = PatientProfileSummary(
            name=current_user.name,
            email=current_user.email,
            height_cm=current_user.height_cm,
            birth_date=current_user.birth_date,
            age=_calculate_age(current_user.birth_date),
            created_at=current_user.created_at,
        )

        # 2. Registros físicos
        physicals = (
            db.query(PhysicalEvolution)
            .filter(PhysicalEvolution.user_id == current_user.id)
            .order_by(PhysicalEvolution.recorded_at.asc())
            .all()
        )

        first_rec = physicals[0] if physicals else None
        latest_rec = physicals[-1] if physicals else None

        latest_imc = None
        if latest_rec and latest_rec.weight_kg and current_user.height_cm:
            height_m = current_user.height_cm / 100.0
            latest_imc = round(latest_rec.weight_kg / (height_m * height_m), 1)

        delta_weight = None
        if first_rec and latest_rec and first_rec.weight_kg and latest_rec.weight_kg:
            delta_weight = round(latest_rec.weight_kg - first_rec.weight_kg, 1)

        delta_fat = None
        if first_rec and latest_rec and first_rec.body_fat_pct and latest_rec.body_fat_pct:
            delta_fat = round(latest_rec.body_fat_pct - first_rec.body_fat_pct, 1)

        physical_summary = PhysicalSummaryReport(
            total_records=len(physicals),
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

        # 3. Registros clínicos
        clinicals = (
            db.query(ClinicalTest)
            .filter(ClinicalTest.user_id == current_user.id)
            .order_by(ClinicalTest.recorded_at.desc())
            .all()
        )

        validated_count = sum(1 for c in clinicals if c.is_validated)
        latest_clinical = clinicals[0] if clinicals else None
        prev_clinical = clinicals[1] if len(clinicals) > 1 else None

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

        # Enriquecer marcadores com deltas e tendências
        enriched_markers = calculate_biomarker_trends(latest_markers_raw, prev_markers_raw)

        # Alertas ativos (marcadores anormais ou com piora relevante)
        alerts: list[dict[str, Any]] = []
        for m in enriched_markers:
            if m.get("status") in ("alto", "baixo"):
                alerts.append({
                    "marker": m.get("name"),
                    "value": f"{m.get('value')} {m.get('unit')}",
                    "status": m.get("status"),
                    "message": f"Valor {m.get('status')} em relação à faixa de referência ({m.get('reference_range') or 'padrão'}).",
                })
            elif m.get("alert"):
                alerts.append({
                    "marker": m.get("name"),
                    "value": f"{m.get('value')} {m.get('unit')}",
                    "status": m.get("trend"),
                    "message": m.get("alert"),
                })

        clinical_summary = ClinicalSummaryReport(
            total_exams=len(clinicals),
            latest_exam_date=latest_clinical.recorded_at if latest_clinical else None,
            latest_markers=enriched_markers,
            active_alerts=alerts,
            validated_exams_count=validated_count,
        )

        logger.info({"event": "medical_summary_generated", "user_id": current_user.id})

        return MedicalSummaryResponse(
            generated_at=datetime.now(timezone.utc),
            patient=patient_summary,
            physical=physical_summary,
            clinical=clinical_summary,
        )

    except Exception as exc:
        logger.error({"event": "medical_summary_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao gerar relatório médico consolidado",
        )
