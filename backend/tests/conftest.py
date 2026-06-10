"""Shared test fixtures.

The production engine in app/database.py is built at import time with
QueuePool args that crash create_engine for sqlite URLs, so we keep a dummy
(never-connected) Postgres DATABASE_URL in the environment and run every
test against our own in-memory SQLite engine via a get_db override.
"""
import os
import tempfile

# Must be set BEFORE anything imports app.config / app.database.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://t:t@127.0.0.1:1/t")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

# Point all media storage at a throwaway dir so tests never touch /app (or
# C:\app on Windows). Settings reads these at import time.
_MEDIA_ROOT = tempfile.mkdtemp(prefix="elearning-test-media-")
for _name, _sub in {
    "VIDEO_DIR": "videos",
    "PDF_DIR": "pdf_documents",
    "IMAGE_DIR": "images",
    "CERT_DIR": "certificates",
    "SIGNATURE_DIR": os.path.join("images", "signatures"),
}.items():
    _path = os.path.join(_MEDIA_ROOT, _sub)
    os.makedirs(_path, exist_ok=True)
    os.environ.setdefault(_name, _path)

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.core.security import create_access_token
from app.models.user import User, UserRole

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = _override_get_db

# bcrypt at default rounds costs ~250ms per hash/verify; fixture users share
# one cheap low-round hash so authenticated requests stay fast. Endpoints that
# hash for real (register, change-password) still exercise hash_password.
PASSWORD = "password123"
PASSWORD_HASH = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def _reset_verify_rate_limit():
    """The public-verify rate limiter is module-global state."""
    from app.routers import certificates

    certificates._verify_hits.clear()
    yield
    certificates._verify_hits.clear()


def make_user(
    db,
    *,
    username,
    role=UserRole.LEARNER,
    department="กรมป่าไม้",
    is_active=True,
    **overrides,
):
    user = User(
        username=username,
        email=overrides.pop("email", f"{username}@example.com"),
        full_name=overrides.pop("full_name", f"คุณ {username}"),
        hashed_password=PASSWORD_HASH,
        role=role,
        department=department,
        position=overrides.pop("position", "เจ้าหน้าที่"),
        phone=overrides.pop("phone", "0812345678"),
        responsibility=overrides.pop("responsibility", "ดูแลระบบทดสอบ"),
        motivation=overrides.pop("motivation", "พัฒนาความรู้"),
        is_active=is_active,
        **overrides,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def admin_user(db):
    return make_user(db, username="admin1", role=UserRole.ADMIN)


@pytest.fixture()
def instructor_user(db):
    return make_user(db, username="instructor1", role=UserRole.INSTRUCTOR)


@pytest.fixture()
def manager_user(db):
    return make_user(db, username="manager1", role=UserRole.MANAGER)


@pytest.fixture()
def learner_user(db):
    return make_user(db, username="learner1", role=UserRole.LEARNER)


def auth_client(user) -> TestClient:
    """Authenticated client via the same httpOnly cookie the login flow sets."""
    client = TestClient(app)
    token = create_access_token({"sub": str(user.id)})
    client.cookies.set("access_token", token)
    return client


@pytest.fixture()
def client(db):
    return TestClient(app)


@pytest.fixture()
def admin_client(admin_user):
    return auth_client(admin_user)


@pytest.fixture()
def instructor_client(instructor_user):
    return auth_client(instructor_user)


@pytest.fixture()
def manager_client(manager_user):
    return auth_client(manager_user)


@pytest.fixture()
def learner_client(learner_user):
    return auth_client(learner_user)


@pytest.fixture()
def fake_pdf_render(monkeypatch, tmp_path):
    """Certificate PDF rendering goes through weasyprint + disk writes —
    slow and irrelevant to the API behavior under test. Stub it out."""
    from app.routers import certificates

    def _fake_render(cert, user, course, db=None):
        path = tmp_path / f"{cert.certificate_number}.pdf"
        path.write_bytes(b"%PDF-1.4 test stub")
        return path

    monkeypatch.setattr(certificates, "render_certificate_pdf", _fake_render)
    return _fake_render
