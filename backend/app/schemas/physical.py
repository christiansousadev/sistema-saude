"""
M-8: Tipagem forte do JSONB ai_analysis para PhysicalEvolution.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PhysicalAiAnalysis(BaseModel):
    """
    M-8: Schema fortemente tipado para o JSONB ai_analysis de PhysicalEvolution.

    Campos retornados pelos serviços de visão computacional e LLM.
    extra='allow' preserva campos adicionais de engines desconhecidos.
    """

    summary: str | None = None
    body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    muscle_mass_kg: float | None = Field(default=None, ge=0, le=200)
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    bmi: float | None = Field(default=None, ge=0, le=80)
    posture_notes: str | None = None
    recommendations: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    risk_level: Literal["low", "normal", "moderate", "high", "critical"] | None = None
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)
    # campos extras preservados (compatibilidade com engines de terceiros)
    model_config = {"extra": "allow"}


class PhysicalCreate(BaseModel):
    recorded_at: datetime
    weight_kg: float | None = Field(default=None, ge=20, le=500)
    body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    muscle_mass_kg: float | None = Field(default=None, ge=0, le=200)
    notes: str | None = None


class PhysicalResponse(BaseModel):
    id: int
    user_id: int
    recorded_at: datetime
    weight_kg: float | None
    body_fat_pct: float | None
    muscle_mass_kg: float | None
    photo_path: str | None
    # M-8: PhysicalAiAnalysis | None ao invés de dict | None
    ai_analysis: PhysicalAiAnalysis | None = None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PhysicalListResponse(BaseModel):
    total: int
    items: list[PhysicalResponse]
