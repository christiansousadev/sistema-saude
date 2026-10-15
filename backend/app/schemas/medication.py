from __future__ import annotations

import datetime as dt
from pydantic import BaseModel, ConfigDict, Field


class MedicationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=100)
    category: str = Field(default="medicamento", max_length=50)
    instructions: str | None = Field(default=None, max_length=1000)
    is_active: bool = True
    start_date: dt.date | None = None
    end_date: dt.date | None = None


class MedicationCreate(MedicationBase):
    pass


class MedicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    dosage: str | None = Field(default=None, min_length=1, max_length=100)
    frequency: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    instructions: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None


class MedicationResponse(MedicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: dt.datetime
    updated_at: dt.datetime


class MedicationListResponse(BaseModel):
    items: list[MedicationResponse]
    total: int
