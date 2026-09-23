import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.db.models import ClinicalTest
from app.db.session import get_db
from app.schemas.clinical import ClinicalDataUpdate, ClinicalListResponse, ClinicalResponse
from app.services import ai_factory, storage

logger = logging.getLogger("audit.clinical")

router = APIRouter(prefix="/clinical", tags=["clinical"])


# CRIA EXAME CLINICO COM EXTRACAO AUTOMATICA VIA IA
@router.post("/", response_model=ClinicalResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("15/minute")
def create_clinical(
    request: Request,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    recorded_at: Annotated[datetime, Form()],
    notes: Annotated[str | None, Form()] = None,
    file: Annotated[UploadFile | None, File()] = None,
):
    file_path: str | None = None
    extracted_data: dict | None = None
    extraction_engine = None

    try:
        if file and file.filename:
            file_path = storage.save_upload(
                file=file,
                subfolder=f"clinical/{current_user.id}",
                allowed_ext={".pdf", ".jpg", ".jpeg", ".png"},
            )
            absolute = str(storage.abs_path(file_path))
            extracted_data, extraction_engine = ai_factory.extract_clinical_document(
                current_user.id, absolute, db
            )

        # inicia sempre como não validado — o usuário confirma via mapeamento manual
        has_markers = bool(
            extracted_data
            and isinstance(extracted_data.get("markers"), list)
            and len(extracted_data["markers"]) > 0
        )
        record = ClinicalTest(
            user_id=current_user.id,
            recorded_at=recorded_at,
            file_path=file_path,
            extracted_data=extracted_data,
            extraction_engine=extraction_engine,
            notes=notes,
            is_validated=False,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        logger.info({
            "event": "clinical_created",
            "record_id": record.id,
            "user_id": current_user.id,
            "engine": str(extraction_engine),
        })
        return ClinicalResponse.model_validate(record)

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        if file_path:
            storage.delete_file(file_path)
        logger.error({"event": "clinical_create_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao salvar exame clínico",
        )


# LISTA EXAMES CLINICOS DO USUARIO
@router.get("/", response_model=ClinicalListResponse)
def list_clinical(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    try:
        base_q = db.query(ClinicalTest).filter(ClinicalTest.user_id == current_user.id)
        total = base_q.count()
        items = (
            base_q.order_by(ClinicalTest.recorded_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return ClinicalListResponse(
            total=total,
            items=[ClinicalResponse.model_validate(i) for i in items],
        )
    except Exception as exc:
        logger.error({"event": "clinical_list_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao buscar exames",
        )


# RETORNA EXAME CLINICO POR ID
@router.get("/{record_id}", response_model=ClinicalResponse)
def get_clinical(
    record_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        record = (
            db.query(ClinicalTest)
            .filter(ClinicalTest.id == record_id, ClinicalTest.user_id == current_user.id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="exame não encontrado")
        return ClinicalResponse.model_validate(record)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error({"event": "clinical_get_error", "record_id": record_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao buscar exame",
        )


# ATUALIZA DADOS EXTRAIDOS DO EXAME VIA INSERCAO MANUAL
@router.patch("/{record_id}/data", response_model=ClinicalResponse)
def patch_clinical_data(
    record_id: int,
    payload: ClinicalDataUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        record = (
            db.query(ClinicalTest)
            .filter(ClinicalTest.id == record_id, ClinicalTest.user_id == current_user.id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="exame não encontrado")

        # model_dump(mode="json") serializa date/etc antes de gravar no jsonb
        record.extracted_data = payload.extracted_data.model_dump(mode="json")
        if payload.notes is not None:
            record.notes = payload.notes
        # inserção manual confirma os dados
        record.is_validated = True

        db.commit()
        db.refresh(record)
        logger.info({"event": "clinical_data_updated", "record_id": record_id, "user_id": current_user.id, "validated": True})
        return ClinicalResponse.model_validate(record)

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "clinical_data_update_error", "record_id": record_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao atualizar dados do exame",
        )


# REMOVE EXAME CLINICO E ARQUIVO ASSOCIADO
@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinical(
    record_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        record = (
            db.query(ClinicalTest)
            .filter(ClinicalTest.id == record_id, ClinicalTest.user_id == current_user.id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="exame não encontrado")

        if record.file_path:
            storage.delete_file(record.file_path)

        db.delete(record)
        db.commit()
        logger.info({"event": "clinical_deleted", "record_id": record_id, "user_id": current_user.id})

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "clinical_delete_error", "record_id": record_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao remover exame",
        )
