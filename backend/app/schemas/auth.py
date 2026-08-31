import logging
import re
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    height_cm: float | None = Field(default=None, ge=50, le=300)
    birth_date: date | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("ao menos 8 caracteres")
        if not re.search(r"[A-Z]", v):
            errors.append("ao menos uma letra maiúscula")
        if not re.search(r"[0-9]", v):
            errors.append("ao menos um número")
        if errors:
            raise ValueError("senha deve conter: " + ", ".join(errors))
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: str | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool
    is_superadmin: bool
    height_cm: float | None
    birth_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}
