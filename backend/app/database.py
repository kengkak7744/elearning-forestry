from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# QueuePool sizing args are invalid for SQLite's pool classes — only pass
# them for real server databases (Postgres in prod).
_pool_kwargs = (
    {}
    if settings.DATABASE_URL.startswith("sqlite")
    else {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}
)

engine = create_engine(settings.DATABASE_URL, **_pool_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that yields a database session for FastAPI endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()