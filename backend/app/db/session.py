"""Database engine / session management. SQLite by default, PostgreSQL-ready."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base

_is_sqlite = settings.resolved_database_url.startswith("sqlite")

# SQLite keeps its local-dev tuning; any server database (Postgres on
# Render/Neon) gets a small recycled pool that survives DB restarts and
# scale-to-zero — a stale socket must never kill a request.
_engine_kwargs: dict = {"future": True}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs.update(
        pool_pre_ping=True,   # ping before use: transparently reconnect
        pool_recycle=1800,    # retire idle sockets before the server does
        pool_size=5,
        max_overflow=5,
        # Fail fast instead of hanging: a serverless Postgres (Neon) that is
        # unreachable would otherwise block the boot health check for minutes.
        connect_args={"connect_timeout": 10},
    )

engine = create_engine(settings.resolved_database_url, **_engine_kwargs)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):  # pragma: no cover
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False,
                            future=True)


def init_db() -> None:
    # Import all model modules so metadata is populated.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
