import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.db.models import Medication
from app.db.session import get_db
from app.schemas.medication import (
    MedicationCreate,
    MedicationListResponse,
    MedicationResponse,
    MedicationUpdate,
)

logger = logging.getLogger("audit.medications")

router = APIRouter(prefix="/medications", tags=["medications"])


# LISTA MEDICAMENTOS DO USUARIO
@router.get("", response_model=MedicationListResponse)
def list_medications(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    active_only: bool = Query(False, description="filtrar apenas medicamentos ativos"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    try:
        query = db.query(Medication).filter(Medication.user_id == current_user.id)
        if active_only:
            query = query.filter(Medication.is_active.is_(True))

        total = query.count()
        items = (
            query.order_by(Medication.is_active.desc(), Medication.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return MedicationListResponse(
            items=[MedicationResponse.model_validate(m) for m in items],
            total=total,
        )
    except Exception as exc:
        logger.error(json.dumps({"event": "list_medications_error", "user_id": current_user.id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao listar medicamentos",
        )


# CRIA NOVO MEDICAMENTO OU SUPLEMENTO
@router.post("", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def create_medication(
    payload: MedicationCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        med = Medication(
            user_id=current_user.id,
            name=payload.name,
            dosage=payload.dosage,
            frequency=payload.frequency,
            category=payload.category,
            instructions=payload.instructions,
            is_active=payload.is_active,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
        db.add(med)
        db.commit()
        db.refresh(med)

        logger.info(json.dumps({
            "event": "medication_created",
            "user_id": current_user.id,
            "medication_id": med.id,
            "name": med.name,
        }))
        return MedicationResponse.model_validate(med)
    except Exception as exc:
        db.rollback()
        logger.error(json.dumps({"event": "create_medication_error", "user_id": current_user.id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao cadastrar medicamento",
        )


# CONSULTA MEDICAMENTO ESPECIFICO
@router.get("/{med_id}", response_model=MedicationResponse)
def get_medication(
    med_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    med = (
        db.query(Medication)
        .filter(Medication.id == med_id, Medication.user_id == current_user.id)
        .first()
    )
    if not med:
        logger.warning(json.dumps({"event": "medication_not_found", "user_id": current_user.id, "med_id": med_id}))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="medicamento nao encontrado",
        )
    return MedicationResponse.model_validate(med)


# ATUALIZA DADOS DO MEDICAMENTO
@router.put("/{med_id}", response_model=MedicationResponse)
def update_medication(
    med_id: int,
    payload: MedicationUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        med = (
            db.query(Medication)
            .filter(Medication.id == med_id, Medication.user_id == current_user.id)
            .first()
        )
        if not med:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="medicamento nao encontrado",
            )

        update_data = payload.model_dump(exclude_unset=True)
        for key, val in update_data.items():
            setattr(med, key, val)

        db.commit()
        db.refresh(med)

        logger.info(json.dumps({
            "event": "medication_updated",
            "user_id": current_user.id,
            "medication_id": med.id,
        }))
        return MedicationResponse.model_validate(med)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(json.dumps({"event": "update_medication_error", "user_id": current_user.id, "med_id": med_id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao atualizar medicamento",
        )


# REMOVE MEDICAMENTO DO USUARIO
@router.delete("/{med_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(
    med_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        med = (
            db.query(Medication)
            .filter(Medication.id == med_id, Medication.user_id == current_user.id)
            .first()
        )
        if not med:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="medicamento nao encontrado",
            )

        db.delete(med)
        db.commit()

        logger.info(json.dumps({
            "event": "medication_deleted",
            "user_id": current_user.id,
            "medication_id": med_id,
        }))
        return None
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(json.dumps({"event": "delete_medication_error", "user_id": current_user.id, "med_id": med_id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao excluir medicamento",
        )
