import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings

# importa todos os modelos para o autogenerate detectar alterações de schema
import app.db.models  # noqa: F401
from app.db.base import Base

# ─── CONFIGURACAO BASE ────────────────────────────────────────────────────────

alembic_cfg = context.config

if alembic_cfg.config_file_name is not None:
    fileConfig(alembic_cfg.config_file_name)

# sobrescreve a url placeholder do alembic.ini pelo valor real vindo do .env
alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

logger = logging.getLogger("alembic.env")


# ─── MODO OFFLINE (gera sql sem conectar) ─────────────────────────────────────

def run_migrations_offline() -> None:
    url = alembic_cfg.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ─── MODO ONLINE (conecta e executa diretamente) ──────────────────────────────

def run_migrations_online() -> None:
    try:
        connectable = engine_from_config(
            alembic_cfg.get_section(alembic_cfg.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()

    except Exception as exc:
        logger.error("falha ao executar migrations online: %s", exc)
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
