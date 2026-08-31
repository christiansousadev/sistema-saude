import os
import sys
from pathlib import Path

# adiciona o diretório backend ao sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Define variáveis de ambiente seguras para testes
os.environ["APP_ENV"] = "development"
os.environ["SECRET_KEY"] = "test-secret-key-64-characters-for-testing-purposes-antigravity"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.security import create_short_access_token, hash_password
from app.db.base import Base
from app.db.models import User
from app.db.session import get_db
from app.main import app

# Engine SQLite em memória compartilhada para testes
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Cria tabelas limpas para cada teste e destrói após a execução."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Cliente de teste FastAPI com override do get_db."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, base_url="http://test") as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Cria um usuário padrão no banco para testes."""
    user = User(
        name="Carlos Silva",
        email="carlos@exemplo.com",
        hashed_password=hash_password("SenhaForte123!"),
        height_cm=180.0,
        is_active=True,
        is_superadmin=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Gera cookies de autenticação válidos para o usuário de teste."""
    token = create_short_access_token(test_user.email)
    return {"Cookie": f"ss_access_token={token}; ss_session_exp=9999999999"}
