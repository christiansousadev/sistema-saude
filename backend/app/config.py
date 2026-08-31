from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    UPLOAD_DIR: str = "uploads"

    # origens permitidas no CORS; em produção, liste explicitamente cada domínio
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # identificação da aplicação nos logs
    APP_ENV: str = "development"

    # B-7: pool de conexões configurável via env
    # 1 worker → pool_size=5 é suficiente; escalar junto com --workers
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30   # segundos antes de lançar OperationalError
    DB_POOL_RECYCLE: int = 1800  # recicla conexões após 30 min (evita idle timeout do Postgres)


settings = Settings()
