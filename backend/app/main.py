import json
import logging
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router
from app.config import settings
from app.core.deps import _extract_token, resolve_user_from_token
from app.core.limiter import limiter
from app.db.models import RefreshToken
from app.db.session import SessionLocal


# ─── CONFIGURA LOGGING ESTRUTURADO ────────────────────────────────────────────

class _JsonFormatter(logging.Formatter):
    """serializa registros de auditoria (dict) para json de uma linha."""

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        if isinstance(record.msg, dict):
            entry = {
                "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
                "level": record.levelname,
                "logger": record.name,
                **record.msg,
            }
            return json.dumps(entry, ensure_ascii=False, default=str)
        return super().format(record)


def _setup_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())

    # aplica o formatter estruturado em TODOS os loggers de auditoria
    audit_loggers = (
        "audit.auth",
        "audit.clinical",
        "audit.physical",
        "audit.config",
        "audit.deps",
        "audit.ai_factory",
        "audit.storage",
        "audit.llm_service",
        "audit.cv_service",
        "audit.security",
        "audit.api.admin",
        "audit.startup",
        "audit.error",
        "audit.db",
    )
    for name in audit_loggers:
        log = logging.getLogger(name)
        log.setLevel(logging.DEBUG)
        log.handlers = [handler]
        log.propagate = False

    # uvicorn e sqlalchemy continuam no formato padrão
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


# ─── CICLO DE VIDA DA APLICACAO ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _setup_logging()

    # garante que o diretório de uploads exista na inicialização
    upload_path = Path(settings.UPLOAD_DIR).resolve()
    upload_path.mkdir(parents=True, exist_ok=True)

    startup_log = logging.getLogger("audit.startup")
    startup_log.setLevel(logging.INFO)
    startup_log.info({
        "event": "app_started",
        "env": settings.APP_ENV,
        "upload_dir": str(upload_path),
        "allowed_origins": settings.ALLOWED_ORIGINS,
    })

    # M-5a: limpa refresh tokens expirados no startup para manter a tabela enxuta
    try:
        from datetime import datetime, timezone
        db = SessionLocal()
        deleted = (
            db.query(RefreshToken)
            .filter(RefreshToken.expires_at < datetime.now(timezone.utc))
            .delete()
        )
        db.commit()
        db.close()
        if deleted:
            startup_log.info({"event": "expired_refresh_tokens_cleaned", "count": deleted})
    except Exception as exc:
        startup_log.warning({"event": "refresh_token_cleanup_error", "error": str(exc)})

    yield

    startup_log.info({"event": "app_shutdown"})


# ─── INSTANCIA FASTAPI ────────────────────────────────────────────────────────

app = FastAPI(
    title="Sistema Saúde API",
    version="1.0.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

# ─── RATE LIMITER ─────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ─── MIDDLEWARES ──────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    # métodos e headers explícitos ao invés de wildcard
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def _request_id_middleware(request: Request, call_next):
    """injeta x-request-id em cada resposta para rastreabilidade."""
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["x-request-id"] = request_id
    response.headers["x-response-time-ms"] = str(elapsed_ms)
    return response


# ─── HANDLER DE ERROS NAO TRATADOS ───────────────────────────────────────────

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    logger = logging.getLogger("audit.error")
    logger.error({
        "event": "unhandled_exception",
        "path": request.url.path,
        "method": request.method,
        "error": str(exc),
        "type": type(exc).__name__,
    })
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "erro interno no servidor"},
    )


# ─── ROUTERS ─────────────────────────────────────────────────────────────────

app.include_router(api_router)


# ─── ARQUIVOS DE UPLOAD — ENDPOINT AUTENTICADO ───────────────────────────────
# SEGURANÇA: NÃO usar StaticFiles para uploads — requer autenticação e IDOR check

@app.get("/uploads/{subfolder}/{filename}", tags=["uploads"])
def serve_upload(
    subfolder: str,
    filename: str,
    request: Request,
):
    """
    Serve arquivos de upload com verificação de propriedade.
    O path é no formato /uploads/<tipo>/<user_id>/<filename>
    ex: /uploads/physical/7/abc123.jpg
    """
    # valida que subfolder e filename não contenham path traversal
    if ".." in subfolder or ".." in filename:
        raise HTTPException(status_code=400, detail="caminho inválido")
    if not re.match(r"^[a-zA-Z0-9_/\-]+$", subfolder):
        raise HTTPException(status_code=400, detail="caminho inválido")
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", filename):
        raise HTTPException(status_code=400, detail="nome de arquivo inválido")

    # S-1: reaproveita a mesma extração/validação de token usada nas rotas protegidas (core/deps)
    # <img> e <Image> enviam o cookie automaticamente para same-site requests
    jwt_token = _extract_token(request)
    if not jwt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="autenticação necessária para acessar arquivos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = SessionLocal()
    try:
        user = resolve_user_from_token(jwt_token, db)

        # verifica que o arquivo pertence ao usuário autenticado
        # subfolder tem formato "physical/{user_id}" ou "clinical/{user_id}"
        parts = subfolder.split("/")
        if len(parts) >= 2:
            try:
                file_owner_id = int(parts[-1])
                if file_owner_id != user.id and not user.is_superadmin:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="acesso negado")
            except ValueError:
                raise HTTPException(status_code=400, detail="caminho de usuário inválido")
    finally:
        db.close()

    upload_path = Path(settings.UPLOAD_DIR).resolve()
    file_path = upload_path / subfolder / filename

    # garante que o path final está dentro do diretório de uploads (path traversal)
    try:
        file_path.resolve().relative_to(upload_path)
    except ValueError:
        raise HTTPException(status_code=400, detail="caminho inválido")

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="arquivo não encontrado")

    return FileResponse(file_path)


# ─── HEALTHCHECK ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["infra"])
def health():
    # não expõe informação de ambiente ao exterior
    return {"status": "ok"}
