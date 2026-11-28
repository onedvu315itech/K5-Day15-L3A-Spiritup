"""Engine, session, kiểu cột dùng chung cho PostgreSQL (Supabase) và SQLite (test, chạy thử)."""
from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, DateTime, Integer, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import TypeDecorator

# jsonb trên Postgres, JSON (text) trên SQLite.
JSONType = JSON().with_variant(JSONB(), "postgresql")
# bigint identity trên Postgres; SQLite chỉ tự tăng với INTEGER PRIMARY KEY.
BigId = BigInteger().with_variant(Integer(), "sqlite")


class UTCDateTime(TypeDecorator):
    """timestamptz; luôn trả datetime có múi giờ UTC (SQLite không giữ múi giờ)."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        if value is not None and dialect.name == "sqlite":
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


def normalize_url(url: str) -> str:
    """Chuỗi Supabase `postgresql://` → driver psycopg 3."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def make_engine(url: str):
    url = normalize_url(url)
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    # Pooler của Supabase (transaction mode) không hỗ trợ prepared statement.
    return create_engine(url, pool_pre_ping=True, connect_args={"prepare_threshold": None})


_engine = None
_Session = None


def init_engine(url: str | None = None):
    global _engine, _Session
    if url is None:
        from app.config import get_settings
        url = get_settings().database_url
    _engine = make_engine(url)
    _Session = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def session_factory():
    if _Session is None:
        init_engine()
    return _Session


def get_db():
    """Dependency FastAPI: một session mỗi request."""
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()
