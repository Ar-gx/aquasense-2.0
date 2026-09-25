"""Database engine / session management. SQLite by default, PostgreSQL-ready."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core import state
from app.core.config import settings
from app.db.base import Base

# SQLAlchemy 2.1 (Sep 2026) made bare postgresql:// mean psycopg (v3); we
# ship psycopg2, so name the driver in the URL instead of trusting a default
# that has already changed once. A URL that names its driver is left alone.
def database_url() -> str:
    url = settings.resolved_database_url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


_is_sqlite = database_url().startswith("sqlite")

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

engine = None
try:
    engine = create_engine(database_url(), **_engine_kwargs)
except Exception as exc:  # noqa: BLE001
    # Import-time failure (missing/broken driver, unparsable URL). Render
    # throws away the logs of a dead deploy, so record the error here and
    # keep the process alive — /api/v1/health will report it.
    state.note_failure(exc)

if _is_sqlite and engine is not None:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):  # pragma: no cover
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False,
                            future=True)


def init_db() -> None:
    if engine is None:
        # Driver/URL problem recorded in state.boot_error — nothing to create.
        return

    # Import all model modules so metadata is populated.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
