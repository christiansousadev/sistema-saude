import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

logger = logging.getLogger("audit.storage")

_ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".webp"}
_ALLOWED_DOC = {".pdf", ".jpg", ".jpeg", ".png"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_CHUNK_BYTES = 1024 * 1024  # 1 MB por bloco de leitura

# mapeamento extensão → MIME types aceitos para validação de conteúdo real (M-7)
_EXT_TO_MIMES: dict[str, set[str]] = {
    ".jpg":  {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png":  {"image/png"},
    ".webp": {"image/webp"},
    ".pdf":  {"application/pdf"},
}


def _base_dir() -> Path:
    return Path(settings.UPLOAD_DIR).resolve()


def abs_path(relative: str) -> Path:
    return _base_dir() / relative


def _validate_mime(content: bytes, suffix: str) -> None:
    """Valida o conteúdo real do arquivo contra os MIME types permitidos para a extensão."""
    try:
        import magic
    except ImportError as exc:
        # sem python-magic não há como validar o conteúdo real — recusa o upload em vez de degradar
        logger.error({"event": "storage_mime_check_unavailable", "reason": "python-magic não instalado"})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="validação de conteúdo de arquivo indisponível no servidor",
        ) from exc

    detected = magic.from_buffer(content, mime=True)
    allowed = _EXT_TO_MIMES.get(suffix, set())
    if detected not in allowed:
        logger.warning({
            "event": "storage_mime_rejected",
            "detected_mime": detected,
            "expected_suffix": suffix,
        })
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"conteúdo do arquivo não corresponde à extensão {suffix} (detectado: {detected})",
        )


# LE O ARQUIVO EM BLOCOS E ABORTA CEDO SE ULTRAPASSAR O LIMITE
def _read_with_limit(file: UploadFile, max_bytes: int) -> bytes:
    """evita carregar um upload gigante inteiro na memória antes de rejeitar."""
    chunks: list[bytes] = []
    total = 0
    try:
        while True:
            chunk = file.file.read(_CHUNK_BYTES)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"arquivo excede {max_bytes // (1024 * 1024)} MB",
                )
            chunks.append(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error({"event": "storage_read_error", "error": str(exc)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="falha ao ler arquivo")

    return b"".join(chunks)


# SALVA ARQUIVO ENVIADO PELO USUARIO EM DISCO
def save_upload(
    file: UploadFile,
    subfolder: str,
    allowed_ext: set[str] | None = None,
    max_bytes: int = _MAX_BYTES,
) -> str:
    if allowed_ext is None:
        allowed_ext = _ALLOWED_IMAGE | _ALLOWED_DOC

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_ext:
        logger.warning({"event": "storage_rejected", "filename": file.filename, "suffix": suffix})
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"extensão não permitida: {suffix}. Aceitas: {sorted(allowed_ext)}",
        )

    # leitura em blocos com corte antecipado — não esgota memória com upload malicioso grande
    content = _read_with_limit(file, max_bytes)

    # valida o conteúdo real do arquivo (M-7)
    _validate_mime(content, suffix)

    dest_dir = _base_dir() / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{suffix}"
    dest = dest_dir / filename
    relative = f"{subfolder}/{filename}"

    try:
        dest.write_bytes(content)
        logger.info({"event": "storage_saved", "path": relative, "bytes": len(content)})
        return relative
    except Exception as exc:
        logger.error({"event": "storage_write_error", "path": relative, "error": str(exc)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="falha ao gravar arquivo")


# REMOVE ARQUIVO DO DISCO SE EXISTIR
def delete_file(relative: str) -> None:
    path = abs_path(relative)
    try:
        if path.exists():
            path.unlink()
            logger.info({"event": "storage_deleted", "path": relative})
    except Exception as exc:
        logger.error({"event": "storage_delete_error", "path": relative, "error": str(exc)})
