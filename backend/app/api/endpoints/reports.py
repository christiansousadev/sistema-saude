import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.db.session import get_db
from app.schemas.reports import MedicalSummaryResponse
from app.services.medical_summary import build_medical_summary

logger = logging.getLogger("audit.clinical")

router = APIRouter(prefix="/reports", tags=["reports"])


# GERA RELATORIO MEDICO CONSOLIDADO DO PACIENTE
@router.get("/summary", response_model=MedicalSummaryResponse)
def get_medical_summary(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        summary = build_medical_summary(current_user, db)
        logger.info(json.dumps({"event": "medical_summary_generated", "user_id": current_user.id}))
        return summary
    except Exception as exc:
        logger.error(json.dumps({"event": "medical_summary_error", "user_id": current_user.id, "error": str(exc)}))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao gerar relatorio medico consolidado",
        )
