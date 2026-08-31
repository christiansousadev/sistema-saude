"""
B-7: Pool de banco configurável via variáveis de ambiente.

Parâmetros de pool agora vêm de settings (DB_POOL_SIZE, DB_MAX_OVERFLOW,
DB_POOL_TIMEOUT, DB_POOL_RECYCLE) em vez de valores hardcoded.

Regra de dimensionamento:
- 1 worker Uvicorn  →  pool_size=5,  max_overflow=10
- 2 workers         →  pool_size=3,  max_overflow=5  (ou aumentar pool)
- Produção          →  ajustar via env conforme monitoramento de conexões
"""
import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

logger = logging.getLogger("audit.db")

engine_kwargs = {"echo": False}
if "sqlite" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_recycle": settings.DB_POOL_RECYCLE,
    })

engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# FORNECE SESSAO DO BANCO VIA DEPENDENCY INJECTION
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as exc:
        # rollback garante que transações parciais não fiquem abertas
        db.rollback()
        logger.error({"event": "db_session_error", "error": str(exc), "type": type(exc).__name__})
        raise
    finally:
        db.close()
