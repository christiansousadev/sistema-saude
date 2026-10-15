import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.security import hash_password, verify_password
from app.db.models import DoctorShareToken, User
from app.db.session import get_db
from app.schemas.doctor_share import (
    DoctorShareCheckResponse,
    DoctorShareCreate,
    DoctorShareListResponse,
    DoctorShareResponse,
)
from app.schemas.reports import MedicalSummaryResponse
from app.services.medical_summary import build_medical_summary

logger = logging.getLogger("audit.doctor_share")

router = APIRouter(tags=["doctor_share"])


def _to_share_response(share: DoctorShareToken) -> DoctorShareResponse:
    now = datetime.now(timezone.utc)
    exp = share.expires_at if share.expires_at.tzinfo else share.expires_at.replace(tzinfo=timezone.utc)
    is_still_valid = share.is_active and exp > now

    return DoctorShareResponse(
        id=share.id,
        token=share.token,
        recipient_name=share.recipient_name,
        expires_at=share.expires_at,
        created_at=share.created_at,
        access_count=share.access_count,
        is_active=is_still_valid,
        has_pin=bool(share.pin_hash),
        share_url=f"/share/{share.token}",
    )


# GERA NOVO TOKEN DE ACESSO CONVIDADO PARA MEDICO
@router.post("/doctor-share/generate", response_model=DoctorShareResponse, status_code=status.HTTP_201_CREATED)
def generate_doctor_share_token(
    payload: DoctorShareCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        raw_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

        pin_hash = hash_password(payload.pin) if payload.pin else None

        share = DoctorShareToken(
            user_id=current_user.id,
            token=raw_token,
            recipient_name=payload.recipient_name,
            pin_hash=pin_hash,
            expires_at=expires_at,
            is_active=True,
            access_count=0,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        logger.info(json.dumps({
            "event": "doctor_share_created",
            "user_id": current_user.id,
            "token_id": share.id,
            "has_pin": bool(pin_hash),
            "expires_at": str(expires_at),
        }))
        return _to_share_response(share)
    except Exception as exc:
        db.rollback()
        logger.error(json.dumps({"event": "doctor_share_create_error", "user_id": current_user.id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao gerar link de compartilhamento",
        )


# LISTA TOKENS ATIVOS E ANTERIORES DO PACIENTE
@router.get("/doctor-share/tokens", response_model=DoctorShareListResponse)
def list_doctor_share_tokens(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tokens = (
            db.query(DoctorShareToken)
            .filter(DoctorShareToken.user_id == current_user.id)
            .order_by(DoctorShareToken.created_at.desc())
            .all()
        )
        return DoctorShareListResponse(
            items=[_to_share_response(t) for t in tokens],
            total=len(tokens),
        )
    except Exception as exc:
        logger.error(json.dumps({"event": "list_doctor_share_error", "user_id": current_user.id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao listar links de compartilhamento",
        )


# REVOGA TOKEN DE ACESSO DO MEDICO
@router.post("/doctor-share/tokens/{token_id}/revoke", response_model=DoctorShareResponse)
def revoke_doctor_share_token(
    token_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        share = (
            db.query(DoctorShareToken)
            .filter(DoctorShareToken.id == token_id, DoctorShareToken.user_id == current_user.id)
            .first()
        )
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="link de compartilhamento nao encontrado",
            )

        share.is_active = False
        db.commit()
        db.refresh(share)

        logger.info(json.dumps({
            "event": "doctor_share_revoked",
            "user_id": current_user.id,
            "token_id": token_id,
        }))
        return _to_share_response(share)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(json.dumps({"event": "revoke_doctor_share_error", "user_id": current_user.id, "token_id": token_id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao revogar link de compartilhamento",
        )


# PRE-VERIFICACAO DE STATUS DO TOKEN E SE EXIGE PIN
@router.get("/public/reports/share/{token}/check", response_model=DoctorShareCheckResponse)
def check_shared_token_status(
    token: str,
    db: Annotated[Session, Depends(get_db)],
):
    share = (
        db.query(DoctorShareToken)
        .filter(DoctorShareToken.token == token)
        .first()
    )
    if not share or not share.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="link de acesso invalido ou revogado",
        )

    now = datetime.now(timezone.utc)
    exp = share.expires_at if share.expires_at.tzinfo else share.expires_at.replace(tzinfo=timezone.utc)
    if exp <= now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="este link de acesso temporario ja expirou",
        )

    return DoctorShareCheckResponse(
        requires_pin=bool(share.pin_hash),
        recipient_name=share.recipient_name,
        is_valid=True,
        expires_at=share.expires_at,
    )


# CONSULTA PUBLICA DO PRONTUARIO CONSOLIDADO VIA TOKEN TEMPORARIO
@router.get("/public/reports/share/{token}", response_model=MedicalSummaryResponse)
def get_shared_medical_report(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    pin: str | None = Query(None, description="pin de 4 a 8 digitos definido pelo paciente"),
):
    share = (
        db.query(DoctorShareToken)
        .filter(DoctorShareToken.token == token)
        .first()
    )
    if not share or not share.is_active:
        logger.warning(json.dumps({"event": "doctor_share_invalid_or_revoked", "token": token[:8] + "..."}))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="link de acesso expirado ou invalido",
        )

    now = datetime.now(timezone.utc)
    exp = share.expires_at if share.expires_at.tzinfo else share.expires_at.replace(tzinfo=timezone.utc)
    if exp <= now:
        logger.warning(json.dumps({"event": "doctor_share_expired", "token": token[:8] + "..."}))
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="este link de acesso temporario ja expirou",
        )

    # validacao de pin de seguranca caso tenha sido configurado
    if share.pin_hash:
        if not pin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="pin_required",
            )
        if not verify_password(pin, share.pin_hash):
            logger.warning(json.dumps({"event": "doctor_share_invalid_pin", "token_id": share.id}))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="pin_invalid",
            )

    patient_user = db.query(User).filter(User.id == share.user_id).first()
    if not patient_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="paciente nao encontrado",
        )

    try:
        share.access_count += 1
        db.commit()

        logger.info(json.dumps({
            "event": "doctor_share_accessed",
            "token_id": share.id,
            "patient_user_id": patient_user.id,
            "access_count": share.access_count,
        }))

        return build_medical_summary(patient_user, db)
    except Exception as exc:
        db.rollback()
        logger.error(json.dumps({"event": "doctor_share_summary_error", "token_id": share.id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao carregar prontuario compartilhado",
        )
