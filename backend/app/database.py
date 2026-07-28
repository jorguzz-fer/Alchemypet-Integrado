"""Engine, sessão e Base do SQLAlchemy."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


def _normalizar_url(url: str) -> str:
    """Aceita as formas comuns de URL do Postgres e força o driver psycopg (v3).

    O Postgres do Coolify costuma entregar `postgres://...` (alias que o
    SQLAlchemy 2.0 não reconhece) ou `postgresql://...` (que tentaria o
    psycopg2, não instalado). Normalizamos ambos para `postgresql+psycopg://`.
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _normalizar_url(settings.DATABASE_URL)

# sqlite exige connect_args específico; Postgres não.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
