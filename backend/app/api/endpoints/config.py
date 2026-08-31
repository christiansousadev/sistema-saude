import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.security import encrypt_api_key
from app.db.models import ApiConfiguration
from app.db.session import get_db
from app.schemas.config import ApiConfigCreate, ApiConfigResponse

logger = logging.getLogger("audit.config")

router = APIRouter(prefix="/config", tags=["config"])


# RETORNA CONFIGURACAO ATIVA DO USUARIO
@router.get("/active", response_model=ApiConfigResponse | None)
def get_active_config(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        config = (
            db.query(ApiConfiguration)
            .filter(
                ApiConfiguration.user_id == current_user.id,
                ApiConfiguration.is_active.is_(True),
            )
            .order_by(ApiConfiguration.updated_at.desc())
            .first()
        )
        if config:
            config_dict = ApiConfigResponse.model_validate(config).model_dump()
            if config_dict.get("api_key"):
                config_dict["api_key"] = ""
            return config_dict
        return None
    except Exception as exc:
        logger.error({"event": "config_get_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao buscar configuração",
        )


# SALVA NOVA CONFIGURACAO E DESATIVA AS ANTERIORES
@router.post("/", response_model=ApiConfigResponse, status_code=status.HTTP_201_CREATED)
def upsert_config(
    payload: ApiConfigCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        db.query(ApiConfiguration).filter(
            ApiConfiguration.user_id == current_user.id
        ).update({"is_active": False})

        config = ApiConfiguration(
            user_id=current_user.id,
            engine_mode=payload.engine_mode,
            api_key=encrypt_api_key(payload.api_key),
            model_name=payload.model_name,
            base_url=payload.base_url,
            is_active=True,
        )
        db.add(config)
        db.commit()
        db.refresh(config)

        logger.info({
            "event": "config_saved",
            "user_id": current_user.id,
            "engine": config.engine_mode,
            "model": config.model_name,
        })
        return config

    except Exception as exc:
        db.rollback()
        logger.error({"event": "config_save_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao salvar configuração",
        )


# REMOVE CONFIGURACAO DO USUARIO
@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_config(
    config_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        config = (
            db.query(ApiConfiguration)
            .filter(
                ApiConfiguration.id == config_id,
                ApiConfiguration.user_id == current_user.id,
            )
            .first()
        )
        if not config:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="configuração não encontrada")

        db.delete(config)
        db.commit()
        logger.info({"event": "config_deleted", "config_id": config_id, "user_id": current_user.id})

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "config_delete_error", "config_id": config_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao remover configuração",
        )
