import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

logger = logging.getLogger("audit.deps")

# alias reutilizável nas rotas protegidas
DBSession = Annotated[Session, Depends(get_db)]

# nome do cookie HttpOnly que contém o JWT (deve coincidir com auth.py)
_COOKIE_TOKEN = "ss_access_token"


def _extract_token(request: Request) -> str | None:
    """
    S-1: Extrai o JWT de duas fontes possíveis (ordem de prioridade):
    1. Cookie HttpOnly 'ss_access_token' — usado pelo frontend web (mais seguro)
    2. Authorization: Bearer header — fallback para clientes de API (Swagger, curl, mobile)
    """
    # 1. cookie HttpOnly (fonte primária — frontend web)
    token = request.cookies.get(_COOKIE_TOKEN)
    if token:
        return token

    # 2. header Authorization: Bearer (fonte secundária — clientes de API)
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.removeprefix("Bearer ").strip()

    return None


# RESOLVE USUARIO A PARTIR DE UM TOKEN JA EXTRAIDO — compartilhado com rotas
# que não passam pelo Depends padrão (ex: serve_upload em main.py, sessão própria)
def resolve_user_from_token(token: str, db: Session) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        logger.warning({"event": "auth_failed", "reason": "invalid_token"})
        raise unauthorized

    email: str | None = payload.get("sub")
    if not email:
        logger.warning({"event": "auth_failed", "reason": "missing_sub"})
        raise unauthorized

    try:
        user = db.query(User).filter(User.email == email).first()
    except Exception as exc:
        logger.error({"event": "auth_db_error", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro interno ao validar sessão",
        )

    if user is None:
        logger.warning({"event": "auth_failed", "reason": "user_not_found", "email": email})
        raise unauthorized

    if not user.is_active:
        logger.warning({"event": "auth_failed", "reason": "user_inactive", "user_id": user.id})
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="usuário inativo")

    return user


# RESOLVE USUARIO AUTENTICADO A PARTIR DO JWT (cookie ou header)
def get_current_user(
    request: Request,
    db: DBSession,
) -> User:
    token = _extract_token(request)
    if not token:
        logger.warning({"event": "auth_failed", "reason": "no_token"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return resolve_user_from_token(token, db)


CurrentUser = Annotated[User, Depends(get_current_user)]


# VALIDA SE O USUARIO ATUAL E SUPERADMIN
def get_current_superadmin(current_user: CurrentUser) -> User:
    if not current_user.is_superadmin:
        logger.warning({"event": "auth_failed", "reason": "not_superadmin", "user_id": current_user.id})
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permissão negada")
    return current_user


CurrentSuperadmin = Annotated[User, Depends(get_current_superadmin)]
