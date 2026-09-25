"""Process-level startup state, surfaced through /api/v1/health.

Lives in its own module (rather than main.py) so route modules can import
it without a circular import.
"""
from __future__ import annotations

import traceback
from functools import lru_cache

# None means the database came up cleanly on boot.
boot_error: str | None = None

# True once init_db() + seed_all() completed without raising.
db_ready: bool = False


def note_failure(exc: BaseException, limit: int = 3000) -> None:
    """Record an exception with its traceback for /api/v1/health.

    Render discards the logs of a dead deploy, so this is the only channel
    we have for boot-time failures. The tail (innermost frames + message)
    is what survives truncation.
    """
    global boot_error
    tail = f"{traceback.format_exc()}\nERROR: {type(exc).__name__}: {exc}"
    boot_error = tail if len(tail) <= limit else f"…{tail[-limit:]}"


@lru_cache(maxsize=1)
def environment() -> dict:
    """Cheap runtime facts that explain driver problems — cached forever."""
    import importlib.util
    import platform
    import sys
    from importlib import metadata

    import sqlalchemy

    def spec(name: str) -> str:
        try:
            return "found" if importlib.util.find_spec(name) else "missing"
        except Exception as exc:  # noqa: BLE001
            return f"error: {type(exc).__name__}: {exc}"

    def dist(name: str) -> str:
        try:
            return metadata.version(name)
        except Exception:  # noqa: BLE001
            return "not installed"

    return {
        "python": sys.version.split()[0],
        "sqlalchemy": sqlalchemy.__version__,
        "platform": platform.platform(),
        "psycopg2_module": spec("psycopg2"),
        "psycopg_module": spec("psycopg"),
        "psycopg2_binary": dist("psycopg2-binary"),
        "psycopg": dist("psycopg"),
    }
