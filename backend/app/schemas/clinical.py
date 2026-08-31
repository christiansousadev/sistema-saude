"""
M-8: Tipagem forte do JSONB extracted_data para ClinicalTest.

ExtractedDataSchema é usado como tipo de retorno na ClinicalResponse,
substituindo `dict | None` por um schema Pydantic validado.
ClinicalDataUpdate aceita ExtractedDataSchema diretamente (com model_dump).
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.db.models import EngineMode


class MarkerItem(BaseModel):
    """Marcador laboratorial individual extraído do laudo."""

    name: str
    value: float | str
    unit: str = ""
    reference_range: str | None = None
    status: Literal["normal", "alto", "baixo"] | None = None


class ExtractedDataSchema(BaseModel):
    """
    M-8: Schema fortemente tipado para o JSONB extracted_data de ClinicalTest.

    Campos adicionais desconhecidos são permitidos (extra='allow') para
    compatibilidade com engines que retornem campos extras.
    """

    engine: Literal["llm", "local_cv", "manual"]
    status: str
    markers: list[MarkerItem] = Field(default_factory=list)
    exam_type: str | None = None
    exam_date: date | None = None
    lab_name: str | None = None
    summary: str | None = None
    risk_level: Literal["low", "normal", "moderate", "high", "critical"] | None = None
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)
    # campos extras são preservados (para engines de terceiros)
    model_config = {"extra": "allow"}


class ClinicalCreate(BaseModel):
    recorded_at: datetime
    notes: str | None = None


class ClinicalDataUpdate(BaseModel):
    # aceita dict genérico ou ExtractedDataSchema
    extracted_data: dict
    notes: str | None = None


class ClinicalResponse(BaseModel):
    id: int
    user_id: int
    recorded_at: datetime
    file_path: str | None
    # M-8: ExtractedDataSchema | None ao invés de dict | None
    extracted_data: ExtractedDataSchema | None
    extraction_engine: EngineMode | None
    notes: str | None
    is_validated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ClinicalListResponse(BaseModel):
    total: int
    items: list[ClinicalResponse]
