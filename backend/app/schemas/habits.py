from __future__ import annotations

import datetime as dt
from pydantic import BaseModel, ConfigDict, Field


class WaterIncrement(BaseModel):
    increment_ml: int = Field(default=250, ge=50, le=2000)
    date: dt.date | None = None


class WaterUpdate(BaseModel):
    amount_ml: int = Field(ge=0, le=10000)
    goal_ml: int | None = Field(default=None, ge=500, le=10000)
    date: dt.date | None = None


class DailyHabitUpdate(BaseModel):
    date: dt.date | None = None
    water_ml: int | None = Field(default=None, ge=0, le=10000)
    water_goal_ml: int | None = Field(default=None, ge=500, le=10000)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    sleep_quality: int | None = Field(default=None, ge=1, le=5)
    energy_level: int | None = Field(default=None, ge=1, le=5)
    workout_done: bool | None = None
    notes: str | None = None


class DailyHabitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    water_ml: int
    water_goal_ml: int
    pct: int = 0
    sleep_hours: float | None = None
    sleep_quality: int | None = None
    energy_level: int | None = None
    workout_done: bool = False
    notes: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


class WaterHistoryResponse(BaseModel):
    items: list[DailyHabitResponse]
    average_ml: float
    days_logged: int
    goal_reached_days: int
