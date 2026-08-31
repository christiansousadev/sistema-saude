import logging

from sqlalchemy.orm import Session

from app.db.models import ApiConfiguration, EngineMode

logger = logging.getLogger("audit.ai_factory")


# BUSCA CONFIGURACAO ATIVA DO USUARIO
def _get_active_config(user_id: int, db: Session) -> ApiConfiguration | None:
    try:
        return (
            db.query(ApiConfiguration)
            .filter(
                ApiConfiguration.user_id == user_id,
                ApiConfiguration.is_active.is_(True),
            )
            .order_by(ApiConfiguration.updated_at.desc())
            .first()
        )
    except Exception as exc:
        logger.error({"event": "factory_config_error", "user_id": user_id, "error": str(exc)})
        return None


# DECIDE E ACIONA O MOTOR DE ANALISE DE FOTO FISICA
def analyze_physical_photo(user_id: int, absolute_path: str, db: Session) -> dict | None:
    config = _get_active_config(user_id, db)

    if config is None or config.engine_mode == EngineMode.LOCAL:
        logger.info({"event": "factory_route", "user_id": user_id, "engine": "local_cv"})
        try:
            from app.services import cv_service
            return cv_service.analyze_physical_photo(absolute_path)
        except Exception as exc:
            logger.error({"event": "factory_cv_error", "error": str(exc)})
            return None

    logger.info({"event": "factory_route", "user_id": user_id, "engine": "llm", "model": config.model_name})
    try:
        from app.services import llm_service
        return llm_service.analyze_physical_photo(absolute_path, config)
    except Exception as exc:
        logger.error({"event": "factory_llm_error", "error": str(exc)})
        # degrada para local se llm falhar
        logger.warning({"event": "factory_fallback_to_cv", "user_id": user_id})
        try:
            from app.services import cv_service
            return cv_service.analyze_physical_photo(absolute_path)
        except Exception:
            return None


# DECIDE E ACIONA O MOTOR DE EXTRACAO DE EXAME CLINICO
def extract_clinical_document(user_id: int, absolute_path: str, db: Session) -> tuple[dict | None, EngineMode]:
    config = _get_active_config(user_id, db)

    if config is None or config.engine_mode == EngineMode.LOCAL:
        logger.info({"event": "factory_route", "user_id": user_id, "engine": "local_cv"})
        try:
            from app.services import cv_service
            return cv_service.extract_clinical_document(absolute_path), EngineMode.LOCAL
        except Exception as exc:
            logger.error({"event": "factory_cv_error", "error": str(exc)})
            return None, EngineMode.LOCAL

    logger.info({"event": "factory_route", "user_id": user_id, "engine": "llm", "model": config.model_name})
    try:
        from app.services import llm_service
        return llm_service.extract_clinical_document(absolute_path, config), EngineMode.LLM
    except Exception as exc:
        logger.error({"event": "factory_llm_error", "error": str(exc)})
        logger.warning({"event": "factory_fallback_to_cv", "user_id": user_id})
        try:
            from app.services import cv_service
            return cv_service.extract_clinical_document(absolute_path), EngineMode.LOCAL
        except Exception:
            return None, EngineMode.LOCAL
