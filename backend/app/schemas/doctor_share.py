from __future__ import annotations

import datetime as dt
from pydantic import BaseModel, ConfigDict, Field


class DoctorShareCreate(BaseModel):
    recipient_name: str | None = Field(default=None, max_length=120)
    expires_in_hours: int = Field(default=48, ge=1, le=720)
    pin: str | None = Field(default=None, min_length=4, max_length=8)


class DoctorShareResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    recipient_name: str | None
    expires_at: dt.datetime
    created_at: dt.datetime
    access_count: int
    is_active: bool
    has_pin: bool = False
    share_url: str | None = None


class DoctorShareCheckResponse(BaseModel):
    requires_pin: bool
    recipient_name: str | None
    is_valid: bool
    expires_at: dt.datetime


class DoctorShareListResponse(BaseModel):
    items: list[DoctorShareResponse]
    total: int
