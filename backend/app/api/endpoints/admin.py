import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentSuperadmin, DBSession
from app.core.security import encrypt_api_key
from app.db.models import ApiConfiguration, User
from app.schemas.auth import UserResponse
from app.schemas.config import ApiConfigCreate, ApiConfigResponse
from pydantic import BaseModel

class AdminUserListResponse(UserResponse):
    clinical_count: int
    physical_count: int
    active_engine: str | None = None

logger = logging.getLogger("audit.api.admin")

router = APIRouter(prefix="/users", tags=["Admin"])


@router.get("/", response_model=list[AdminUserListResponse])
def list_users(
    db: DBSession,
    current_superadmin: CurrentSuperadmin,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    from sqlalchemy import func
    from app.db.models import ClinicalTest, PhysicalEvolution

    # subqueries para contagens
    clinical_sq = (
        db.query(ClinicalTest.user_id, func.count(ClinicalTest.id).label("c_count"))
        .group_by(ClinicalTest.user_id)
        .subquery()
    )

    physical_sq = (
        db.query(PhysicalEvolution.user_id, func.count(PhysicalEvolution.id).label("p_count"))
        .group_by(PhysicalEvolution.user_id)
        .subquery()
    )

    config_sq = (
        db.query(ApiConfiguration.user_id, ApiConfiguration.engine_mode)
        .filter(ApiConfiguration.is_active == True)
        .subquery()
    )

    results = (
        db.query(
            User,
            func.coalesce(clinical_sq.c.c_count, 0).label("clinical_count"),
            func.coalesce(physical_sq.c.p_count, 0).label("physical_count"),
            config_sq.c.engine_mode.label("active_engine"),
        )
        .outerjoin(clinical_sq, User.id == clinical_sq.c.user_id)
        .outerjoin(physical_sq, User.id == physical_sq.c.user_id)
        .outerjoin(config_sq, User.id == config_sq.c.user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    out = []
    for u, c_count, p_count, engine in results:
        data = UserResponse.model_validate(u).model_dump()
        data["clinical_count"] = c_count
        data["physical_count"] = p_count
        data["active_engine"] = engine.value if engine else None
        out.append(data)

    return out


@router.get("/{user_id}/config", response_model=ApiConfigResponse)
def get_user_config(
    user_id: int,
    db: DBSession,
    current_superadmin: CurrentSuperadmin,
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="usuário não encontrado")

    config = (
        db.query(ApiConfiguration)
        .filter(ApiConfiguration.user_id == user_id, ApiConfiguration.is_active == True)
        .first()
    )

    if not config:
        # retorna um config dummy se nao existir para o frontend nao quebrar
        return {
            "id": 0,
            "user_id": user_id,
            "engine_mode": "llm",
            "api_key": "",
            "model_name": "gemini-1.5-flash",
            "base_url": "",
            "clinical_system_prompt": "",
            "physical_system_prompt": "",
            "is_active": True,
            "created_at": "2000-01-01T00:00:00Z",
            "updated_at": "2000-01-01T00:00:00Z",
        }

    config_dict = ApiConfigResponse.model_validate(config).model_dump()
    if config_dict.get("api_key"):
        config_dict["api_key"] = ""

    return config_dict


@router.post("/{user_id}/config", response_model=ApiConfigResponse)
def update_user_config(
    user_id: int,
    config_in: ApiConfigCreate,
    db: DBSession,
    current_superadmin: CurrentSuperadmin,
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="usuário não encontrado")

    # desativa as configs anteriores deste user
    db.query(ApiConfiguration).filter(
        ApiConfiguration.user_id == user_id, ApiConfiguration.is_active == True
    ).update({"is_active": False})

    # encripta a nova chave se for fornecida
    encrypted_key = None
    if config_in.api_key and config_in.api_key.strip():
        encrypted_key = encrypt_api_key(config_in.api_key)

    new_config = ApiConfiguration(
        user_id=user_id,
        engine_mode=config_in.engine_mode,
        api_key=encrypted_key,
        model_name=config_in.model_name,
        base_url=config_in.base_url,
        clinical_system_prompt=config_in.clinical_system_prompt,
        physical_system_prompt=config_in.physical_system_prompt,
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    
    logger.info({"event": "superadmin_config_updated", "target_user": user_id})
    return new_config
