import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.db.models import PhysicalEvolution
from app.db.session import SessionLocal, get_db
from app.schemas.physical import PhysicalListResponse, PhysicalResponse
from app.services import ai_factory, storage

logger = logging.getLogger("audit.physical")

router = APIRouter(prefix="/physical", tags=["physical"])


# M-9: tarefa de background — executa análise de IA e atualiza o registro no banco
def _run_ai_analysis(record_id: int, user_id: int, absolute_photo_path: str) -> None:
    """
    Executa a análise de IA em background e salva o resultado no registro.

    Usa uma sessão DB própria (independente do ciclo de vida da request)
    para poder escrever no banco após a resposta HTTP ser enviada.
    """
    db = SessionLocal()
    try:
        ai_result = ai_factory.analyze_physical_photo(user_id, absolute_photo_path, db)
        if ai_result:
            record = db.query(PhysicalEvolution).filter(PhysicalEvolution.id == record_id).first()
            if record:
                record.ai_analysis = ai_result
                db.commit()
                logger.info({
                    "event": "ai_analysis_complete",
                    "record_id": record_id,
                    "user_id": user_id,
                })
    except Exception as exc:
        logger.error({
            "event": "ai_analysis_error",
            "record_id": record_id,
            "user_id": user_id,
            "error": str(exc),
        })
    finally:
        db.close()


def _build_physical_response(record: PhysicalEvolution, height_cm: float | None) -> PhysicalResponse:
    waist_to_hip: float | None = None
    waist_to_height: float | None = None
    risk: str | None = None

    if record.waist_cm and record.hip_cm and record.hip_cm > 0:
        waist_to_hip = round(record.waist_cm / record.hip_cm, 2)

    if record.waist_cm and height_cm and height_cm > 0:
        waist_to_height = round(record.waist_cm / height_cm, 2)
        if waist_to_height < 0.50:
            risk = "baixo"
        elif waist_to_height < 0.60:
            risk = "moderado"
        else:
            risk = "elevado"
    elif waist_to_hip is not None:
        if waist_to_hip <= 0.85:
            risk = "baixo"
        elif waist_to_hip <= 0.95:
            risk = "moderado"
        else:
            risk = "elevado"

    resp = PhysicalResponse.model_validate(record)
    resp.waist_to_hip_ratio = waist_to_hip
    resp.waist_to_height_ratio = waist_to_height
    resp.cardiovascular_risk = risk
    return resp


# CRIA REGISTRO DE EVOLUCAO FISICA COM FOTO — ANALISE IA EXECUTADA EM BACKGROUND (M-9)
@router.post("/", response_model=PhysicalResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("15/minute")
def create_physical(
    request: Request,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    background_tasks: BackgroundTasks,
    recorded_at: Annotated[datetime, Form()],
    weight_kg: Annotated[float | None, Form()] = None,
    body_fat_pct: Annotated[float | None, Form()] = None,
    muscle_mass_kg: Annotated[float | None, Form()] = None,
    waist_cm: Annotated[float | None, Form()] = None,
    hip_cm: Annotated[float | None, Form()] = None,
    chest_cm: Annotated[float | None, Form()] = None,
    arm_cm: Annotated[float | None, Form()] = None,
    thigh_cm: Annotated[float | None, Form()] = None,
    neck_cm: Annotated[float | None, Form()] = None,
    notes: Annotated[str | None, Form()] = None,
    photo: Annotated[UploadFile | None, File()] = None,
    photo_back: Annotated[UploadFile | None, File()] = None,
    photo_side: Annotated[UploadFile | None, File()] = None,
):
    photo_path: str | None = None
    photo_back_path: str | None = None
    photo_side_path: str | None = None

    try:
        if photo and photo.filename:
            photo_path = storage.save_upload(
                file=photo,
                subfolder=f"physical/{current_user.id}",
                allowed_ext={".jpg", ".jpeg", ".png", ".webp"},
            )
        if photo_back and photo_back.filename:
            photo_back_path = storage.save_upload(
                file=photo_back,
                subfolder=f"physical/{current_user.id}",
                allowed_ext={".jpg", ".jpeg", ".png", ".webp"},
            )
        if photo_side and photo_side.filename:
            photo_side_path = storage.save_upload(
                file=photo_side,
                subfolder=f"physical/{current_user.id}",
                allowed_ext={".jpg", ".jpeg", ".png", ".webp"},
            )

        # M-9: salva o registro IMEDIATAMENTE (ai_analysis=None por enquanto)
        record = PhysicalEvolution(
            user_id=current_user.id,
            recorded_at=recorded_at,
            weight_kg=weight_kg,
            body_fat_pct=body_fat_pct,
            muscle_mass_kg=muscle_mass_kg,
            photo_path=photo_path,
            photo_back_path=photo_back_path,
            photo_side_path=photo_side_path,
            waist_cm=waist_cm,
            hip_cm=hip_cm,
            chest_cm=chest_cm,
            arm_cm=arm_cm,
            thigh_cm=thigh_cm,
            neck_cm=neck_cm,
            ai_analysis=None,
            notes=notes,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        logger.info({"event": "physical_created", "record_id": record.id, "user_id": current_user.id})

        # M-9: agenda análise de IA em background (não bloqueia a resposta HTTP)
        if photo_path:
            absolute = str(storage.abs_path(photo_path))
            background_tasks.add_task(_run_ai_analysis, record.id, current_user.id, absolute)
            logger.info({
                "event": "ai_analysis_queued",
                "record_id": record.id,
                "user_id": current_user.id,
            })

        return _build_physical_response(record, current_user.height_cm)

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        if photo_path:
            storage.delete_file(photo_path)
        if photo_back_path:
            storage.delete_file(photo_back_path)
        if photo_side_path:
            storage.delete_file(photo_side_path)
        logger.error({"event": "physical_create_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao salvar registro físico",
        )


# LISTA REGISTROS DE EVOLUCAO FISICA DO USUARIO
@router.get("/", response_model=PhysicalListResponse)
def list_physical(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    try:
        base_q = db.query(PhysicalEvolution).filter(PhysicalEvolution.user_id == current_user.id)
        total = base_q.count()
        items = (
            base_q.order_by(PhysicalEvolution.recorded_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return PhysicalListResponse(
            total=total,
            items=[_build_physical_response(i, current_user.height_cm) for i in items],
        )
    except Exception as exc:
        logger.error({"event": "physical_list_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao buscar registros",
        )


# RETORNA REGISTRO DE EVOLUCAO FISICA POR ID
@router.get("/{record_id}", response_model=PhysicalResponse)
def get_physical(
    record_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        record = (
            db.query(PhysicalEvolution)
            .filter(PhysicalEvolution.id == record_id, PhysicalEvolution.user_id == current_user.id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="registro não encontrado")
        return _build_physical_response(record, current_user.height_cm)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error({"event": "physical_get_error", "record_id": record_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao buscar registro",
        )


# REMOVE REGISTRO DE EVOLUCAO FISICA E FOTO ASSOCIADA
@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_physical(
    record_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        record = (
            db.query(PhysicalEvolution)
            .filter(PhysicalEvolution.id == record_id, PhysicalEvolution.user_id == current_user.id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="registro não encontrado")

        if record.photo_path:
            storage.delete_file(record.photo_path)
        if record.photo_back_path:
            storage.delete_file(record.photo_back_path)
        if record.photo_side_path:
            storage.delete_file(record.photo_side_path)

        db.delete(record)
        db.commit()
        logger.info({"event": "physical_deleted", "record_id": record_id, "user_id": current_user.id})

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "physical_delete_error", "record_id": record_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao remover registro",
        )
