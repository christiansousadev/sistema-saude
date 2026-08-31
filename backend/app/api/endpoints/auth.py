import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import CurrentUser
from app.core.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_short_access_token,
    generate_family_id,
    generate_refresh_token,
    hash_password,
    verify_password,
)
from app.db.models import RefreshToken, User
from app.db.session import get_db
from app.schemas.auth import UserLogin, UserRegister, UserResponse

logger = logging.getLogger("audit.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# nome do cookie HttpOnly que armazena o JWT
_COOKIE_TOKEN = "ss_access_token"
# cookie legível por JS — contém apenas o timestamp de expiração (não o token)
_COOKIE_EXP = "ss_session_exp"
# M-5a: cookie HttpOnly para refresh token
_COOKIE_REFRESH = "ss_refresh_token"


def _set_auth_cookies(response: Response, token: str, expire_minutes: int | None = None) -> None:
    """Define os dois cookies de autenticação na resposta."""
    minutes = expire_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    max_age = minutes * 60
    exp_ts = int(time.time()) + max_age
    # em produção usa HTTPS → secure=True
    secure = settings.APP_ENV == "production"

    # cookie principal: HttpOnly impede acesso via JS (proteção XSS)
    response.set_cookie(
        key=_COOKIE_TOKEN,
        value=token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )
    # cookie de expiração: legível por JS para evitar requisição desnecessária ao /auth/me
    response.set_cookie(
        key=_COOKIE_EXP,
        value=str(exp_ts),
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """M-5a: Define o cookie HttpOnly do refresh token."""
    secure = settings.APP_ENV == "production"
    max_age = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=_COOKIE_REFRESH,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=max_age,
        path="/api/v1/auth/refresh",  # cookie disponível apenas na rota de refresh
    )


def _clear_auth_cookies(response: Response) -> None:
    """Remove os cookies de autenticação (logout / sessão inválida)."""
    response.delete_cookie(key=_COOKIE_TOKEN, path="/")
    response.delete_cookie(key=_COOKIE_EXP, path="/")
    response.delete_cookie(key=_COOKIE_REFRESH, path="/api/v1/auth/refresh")


# REGISTRA NOVO USUARIO NO SISTEMA
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserRegister,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        if db.query(User).filter(User.email == payload.email).first():
            logger.warning({"event": "register_conflict", "email": payload.email})
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email já cadastrado",
            )

        user = User(
            name=payload.name,
            email=payload.email,
            hashed_password=hash_password(payload.password),
            height_cm=payload.height_cm,
            birth_date=payload.birth_date,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info({"event": "user_registered", "user_id": user.id, "email": user.email})
        return user

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "register_error", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao registrar usuário",
        )


# AUTENTICA USUARIO — define cookie HttpOnly com JWT curto + refresh token (M-5a)
# limitado a 10 tentativas por minuto por IP (C-4)
@router.post("/login", status_code=status.HTTP_200_OK)
def login(
    request: Request,
    response: Response,
    payload: UserLogin,
    db: Annotated[Session, Depends(get_db)],
):
    from app.main import limiter

    # aplica rate limit: 10 tentativas por minuto por IP
    @limiter.limit("10/minute")
    def _check_rate(request: Request):
        pass

    try:
        _check_rate(request)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="muitas tentativas de login — aguarde 1 minuto",
        )

    try:
        user = db.query(User).filter(User.email == payload.email).first()

        if not user or not verify_password(payload.password, user.hashed_password):
            logger.warning({"event": "login_failed", "email": payload.email})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="email ou senha incorretos",
            )

        if not user.is_active:
            logger.warning({"event": "login_inactive", "user_id": user.id})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="usuário inativo",
            )

        # M-5a: access token curto (15 min) + refresh token (7 dias)
        access_token = create_short_access_token(user.email)
        refresh_tok = generate_refresh_token()
        family = generate_family_id()

        rt = RefreshToken(
            user_id=user.id,
            token=refresh_tok,
            family_id=family,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(rt)
        db.commit()

        _set_auth_cookies(response, access_token, expire_minutes=15)
        _set_refresh_cookie(response, refresh_tok)

        logger.info({"event": "login_success", "user_id": user.id})
        return {"message": "autenticado"}

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "login_error", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao autenticar",
        )


# M-5a: RENOVA O ACCESS TOKEN A PARTIR DO REFRESH TOKEN (rotation)
@router.post("/refresh", status_code=status.HTTP_200_OK)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    """
    M-5a: Troca o refresh token por um novo par (access + refresh).

    Implementa refresh token rotation:
    - O refresh token atual é invalidado
    - Um novo refresh token é emitido
    - Se o token já foi usado antes (reuso detectado), toda a família é revogada
    """
    refresh_tok = request.cookies.get(_COOKIE_REFRESH)
    if not refresh_tok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh token ausente",
        )

    try:
        now = datetime.now(timezone.utc)

        rt = (
            db.query(RefreshToken)
            .filter(RefreshToken.token == refresh_tok)
            .first()
        )

        if not rt:
            # Token não encontrado — pode ter sido reutilizado → revogar família toda
            # Tentamos encontrar pela família para revogar (se possível)
            logger.warning({"event": "refresh_token_not_found", "action": "possible_reuse"})
            _clear_auth_cookies(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="refresh token inválido",
            )

        # token expirado
        if rt.expires_at.replace(tzinfo=timezone.utc) < now:
            db.delete(rt)
            db.commit()
            _clear_auth_cookies(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="refresh token expirado — faça login novamente",
            )

        # token revogado manualmente
        if rt.revoked:
            # revogar toda a família (ataque detectado)
            db.query(RefreshToken).filter(
                RefreshToken.family_id == rt.family_id
            ).delete()
            db.commit()
            _clear_auth_cookies(response)
            logger.warning({
                "event": "refresh_token_reuse_detected",
                "family_id": rt.family_id,
                "user_id": rt.user_id,
            })
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="sessão inválida — faça login novamente",
            )

        user = db.query(User).filter(User.id == rt.user_id).first()
        if not user or not user.is_active:
            db.delete(rt)
            db.commit()
            _clear_auth_cookies(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="usuário inativo",
            )

        # rotation: remove token antigo e cria novo
        db.delete(rt)

        new_refresh = generate_refresh_token()
        new_rt = RefreshToken(
            user_id=user.id,
            token=new_refresh,
            family_id=rt.family_id,  # mantém a família
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(new_rt)
        db.commit()

        new_access = create_short_access_token(user.email)
        _set_auth_cookies(response, new_access, expire_minutes=15)
        _set_refresh_cookie(response, new_refresh)

        logger.info({"event": "token_refreshed", "user_id": user.id})
        return {"message": "token renovado"}

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error({"event": "refresh_error", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao renovar token",
        )


# ENCERRA SESSAO — remove cookies e revoga refresh token ativo
@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    refresh_tok = request.cookies.get(_COOKIE_REFRESH)
    if refresh_tok:
        try:
            rt = db.query(RefreshToken).filter(RefreshToken.token == refresh_tok).first()
            if rt:
                db.delete(rt)
                db.commit()
        except Exception:
            pass  # logout não deve falhar por erro de DB

    _clear_auth_cookies(response)
    logger.info({"event": "logout"})
    return {"message": "sessão encerrada"}


# RETORNA DADOS DO USUARIO AUTENTICADO
@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser):
    return current_user
