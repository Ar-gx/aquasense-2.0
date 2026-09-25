"""Process-level startup state, surfaced through /api/v1/health.

Lives in its own module (rather than main.py) so route modules can import
it without a circular import.
"""
from __future__ import annotations

# None means the database came up cleanly on boot.
boot_error: str | None = None

# True once init_db() + seed_all() completed without raising.
db_ready: bool = False
