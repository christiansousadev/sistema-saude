from datetime import date, datetime
from typing import Any
from pydantic import BaseModel


class PatientProfileSummary(BaseModel):
    name: str
    email: str
    height_cm: float | None
    birth_date: date | None
    age: int | None
    created_at: datetime


class PhysicalSummaryReport(BaseModel):
    total_records: int
    first_record_date: datetime | None
    latest_record_date: datetime | None
    first_weight_kg: float | None
    latest_weight_kg: float | None
    delta_weight_kg: float | None
    first_body_fat_pct: float | None
    latest_body_fat_pct: float | None
    delta_body_fat_pct: float | None
    latest_muscle_mass_kg: float | None
    latest_imc: float | None
    imc_classification: str | None
    latest_ai_analysis: dict[str, Any] | None


class ClinicalSummaryReport(BaseModel):
    total_exams: int
    latest_exam_date: datetime | None
    latest_markers: list[dict[str, Any]]
    active_alerts: list[dict[str, Any]]
    validated_exams_count: int


class MedicalSummaryResponse(BaseModel):
    generated_at: datetime
    patient: PatientProfileSummary
    physical: PhysicalSummaryReport
    clinical: ClinicalSummaryReport
    disclaimer: str = (
        "Este documento é um consolidado de dados de acompanhamento pessoal e "
        "não substitui avaliação, diagnóstico ou prescrição médica profissional."
    )
