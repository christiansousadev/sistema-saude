import base64
import logging
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
import bcrypt
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from app.config import settings

logger = logging.getLogger("audit.security")

# M-5a: access token de curta duração (15 min) quando refresh tokens estão habilitados
ACCESS_TOKEN_SHORT_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


# GERA HASH BCRYPT DA SENHA
def hash_password(plain: str) -> str:
    # gera o salt e o hash usando bcrypt nativo
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


# VERIFICA SENHA CONTRA O HASH ARMAZENADO
def verify_password(plain: str, hashed: str) -> bool:
    try:
        # compara a senha plana em bytes com o hash em bytes
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as exc:
        logger.warning({"event": "verify_password_error", "error": str(exc)})
        return False


# GERA TOKEN JWT DE ACESSO (curto: 15 min quando usa refresh | longo: settings)
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# M-5a: GERA ACCESS TOKEN DE CURTA DURACAO (para uso com refresh tokens)
def create_short_access_token(email: str) -> str:
    """Access token de 15 minutos para uso em conjunto com refresh token."""
    return create_access_token(
        data={"sub": email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_SHORT_MINUTES),
    )


# M-5a: GERA REFRESH TOKEN OPACO (256 bits de entropia)
def generate_refresh_token() -> str:
    """Gera um token opaco criptograficamente seguro (64 chars hex = 256 bits)."""
    return secrets.token_hex(32)


# M-5a: GERA FAMILY ID PARA DETECTAR REUTILIZACAO DE REFRESH TOKEN
def generate_family_id() -> str:
    """Identificador de família de tokens para detecção de reutilização."""
    return secrets.token_hex(16)


# DECODIFICA E VALIDA TOKEN JWT
def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        logger.warning({"event": "token_decode_failed", "error": str(exc)})
        return None


# DERIVA CHAVE DE CRIPTOGRAFIA USANDO HKDF (S-3: substituição do padding de zeros)
def _get_encryption_key() -> bytes:
    """
    Deriva uma chave Fernet de 32 bytes a partir do SECRET_KEY usando HKDF-SHA256.
    HKDF garante entropia máxima independente do tamanho ou conteúdo do SECRET_KEY.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"sistema-saude-api-key-encryption-v1",
    )
    raw_key = hkdf.derive(settings.SECRET_KEY.encode("utf-8"))
    return base64.urlsafe_b64encode(raw_key)


# CRIPTOGRAFA A CHAVE DE API COM FERNET
def encrypt_api_key(api_key: str | None) -> str | None:
    if not api_key:
        return api_key
    try:
        fernet = Fernet(_get_encryption_key())
        return fernet.encrypt(api_key.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        logger.error({"event": "encrypt_api_key_error", "error": str(exc)})
        raise


# DESCRIPTOGRAFA A CHAVE DE API
def decrypt_api_key(encrypted_api_key: str | None) -> str | None:
    if not encrypted_api_key:
        return encrypted_api_key
    try:
        fernet = Fernet(_get_encryption_key())
        return fernet.decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        logger.warning({"event": "decrypt_api_key_error", "error": str(exc)})
        # SEGURANÇA: não faz fallback para plaintext — retorna None e loga o erro
        # Isso força re-configuração da chave em vez de expor dados antigos
        return None
