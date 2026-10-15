import enum
import secrets
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EngineMode(str, enum.Enum):
    LOCAL = "local"
    LLM = "llm"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    api_configurations: Mapped[list["ApiConfiguration"]] = relationship(
        "ApiConfiguration", back_populates="user", cascade="all, delete-orphan"
    )
    physical_evolutions: Mapped[list["PhysicalEvolution"]] = relationship(
        "PhysicalEvolution", back_populates="user", cascade="all, delete-orphan"
    )
    clinical_tests: Mapped[list["ClinicalTest"]] = relationship(
        "ClinicalTest", back_populates="user", cascade="all, delete-orphan"
    )
    daily_habits: Mapped[list["DailyHabit"]] = relationship(
        "DailyHabit", back_populates="user", cascade="all, delete-orphan"
    )
    medications: Mapped[list["Medication"]] = relationship(
        "Medication", back_populates="user", cascade="all, delete-orphan"
    )
    doctor_shares: Mapped[list["DoctorShareToken"]] = relationship(
        "DoctorShareToken", back_populates="user", cascade="all, delete-orphan"
    )


class ApiConfiguration(Base):
    __tablename__ = "api_configurations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    engine_mode: Mapped[EngineMode] = mapped_column(
        Enum(EngineMode, name="enginemode"), nullable=False, default=EngineMode.LLM
    )
    # armazena vazia quando engine_mode=LOCAL
    api_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    clinical_system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    physical_system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="api_configurations")


class PhysicalEvolution(Base):
    __tablename__ = "physical_evolutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # índice em recorded_at para otimizar queries de ordenação (M-6)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    body_fat_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    muscle_mass_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    photo_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    photo_back_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    photo_side_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    waist_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    hip_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    arm_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    thigh_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    neck_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # campo updated_at adicionado (M-5)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="physical_evolutions")


class ClinicalTest(Base):
    __tablename__ = "clinical_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # índice em recorded_at para otimizar queries de ordenação (M-6)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # caminho do pdf/imagem original do exame
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # dados extraídos via ia, estrutura livre por tipo de exame
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # engine_mode usado na extração
    extraction_engine: Mapped[EngineMode | None] = mapped_column(
        Enum(EngineMode, name="enginemode"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # false até o usuário confirmar/inserir dados manualmente
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # campo updated_at adicionado (M-5)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="clinical_tests")


class RefreshToken(Base):
    """
    M-5a: Tabela de refresh tokens para rotation segura.

    Cada login gera um refresh token único de longa duração (7 dias).
    O access token tem duração curta (15 min).
    Ao usar o refresh token, ele é removido e um novo é emitido (rotation).
    Tokens expirados são removidos por cleanup automático no startup.
    """
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # token opaco (256 bits de entropia)
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    # jti: identificador único da família de tokens (para rotação)
    family_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # ip e user-agent para auditoria
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # revogado manualmente (logout em todos os dispositivos)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User")


class DailyHabit(Base):
    __tablename__ = "daily_habits"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_daily_habit"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    water_ml: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    water_goal_ml: Mapped[int] = mapped_column(Integer, default=2500, nullable=False)
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    sleep_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    energy_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    workout_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="daily_habits")


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="medicamento", nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="medications")


class DoctorShareToken(Base):
    __tablename__ = "doctor_share_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    recipient_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="doctor_shares")

