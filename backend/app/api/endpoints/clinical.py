import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.db.models import ClinicalTest
from app.db.session import get_db
from app.schemas.clinical import (
    BiomarkerDataPoint,
    BiomarkerTimelineItem,
    BiomarkerTimelineResponse,
    ClinicalDataUpdate,
    ClinicalListResponse,
    ClinicalResponse,
)
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


def _categorize_biomarker(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ["glicem", "hba1c", "insulin"]):
        return "Glicemia"
    if any(k in n for k in ["colesterol", "hdl", "ldl", "vldl", "triglic"]):
        return "Lipídios"
    if any(k in n for k in ["hemoglo", "hematóc", "leucóc", "plaquet", "hemác"]):
        return "Hemograma"
    if any(k in n for k in ["tsh", "t4", "t3"]):
        return "Tireoide"
    if any(k in n for k in ["creatin", "ureia", "ácido úrico", "acido urico"]):
        return "Função Renal"
    if any(k in n for k in ["tgo", "tgp", "gama gt", "bilirrub"]):
        return "Função Hepática"
    if any(k in n for k in ["vitamina", "ferritin", "ferro"]):
        return "Vitaminas e Minerais"
    if any(k in n for k in ["pcr", "vhs"]):
        return "Inflamação"
    return "Outros"


def _parse_numeric(val: float | str | None) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        cleaned = val.strip().replace(",", ".")
        cleaned = cleaned.lstrip("<>~=").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


# OBTEM HISTORICO LONGITUDINAL DE BIOMARCADORES
@router.get("/biomarkers/timeline", response_model=BiomarkerTimelineResponse)
def get_biomarker_timeline(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tests = (
            db.query(ClinicalTest)
            .filter(ClinicalTest.user_id == current_user.id)
            .order_by(ClinicalTest.recorded_at.asc())
            .all()
        )

        biomarkers_dict: dict[str, dict] = {}

        for test in tests:
            if not test.extracted_data or not isinstance(test.extracted_data, dict):
                continue
            markers = test.extracted_data.get("markers")
            if not markers or not isinstance(markers, list):
                continue

            test_date_str = test.recorded_at.strftime("%Y-%m-%d")

            for m in markers:
                if not isinstance(m, dict):
                    continue
                raw_name = m.get("name")
                if not raw_name or not isinstance(raw_name, str):
                    continue
                name = raw_name.strip()
                parsed_val = _parse_numeric(m.get("value"))
                if parsed_val is None:
                    continue

                unit = str(m.get("unit") or "").strip()
                ref = m.get("reference_range")
                status_val = m.get("status")
                valid_status = status_val if status_val in ("normal", "alto", "baixo") else None

                if name not in biomarkers_dict:
                    biomarkers_dict[name] = {
                        "name": name,
                        "category": _categorize_biomarker(name),
                        "unit": unit,
                        "reference_range": ref,
                        "latest_value": parsed_val,
                        "latest_status": valid_status,
                        "data_points": [],
                    }

                biomarkers_dict[name]["unit"] = unit or biomarkers_dict[name]["unit"]
                if ref:
                    biomarkers_dict[name]["reference_range"] = ref
                biomarkers_dict[name]["latest_value"] = parsed_val
                biomarkers_dict[name]["latest_status"] = valid_status

                biomarkers_dict[name]["data_points"].append(
                    BiomarkerDataPoint(
                        date=test_date_str,
                        value=parsed_val,
                        unit=unit,
                        reference_range=ref,
                        status=valid_status,
                        exam_id=test.id,
                    )
                )

        items = [
            BiomarkerTimelineItem(**v)
            for v in sorted(biomarkers_dict.values(), key=lambda x: (x["category"], x["name"]))
        ]

        logger.info({"event": "biomarker_timeline_fetched", "user_id": current_user.id, "total": len(items)})
        return BiomarkerTimelineResponse(biomarkers=items)

    except Exception as exc:
        logger.error({"event": "biomarker_timeline_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao carregar historico de biomarcadores",
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
