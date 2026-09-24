"""Consistent API response envelope + error handling helpers."""
from __future__ import annotations

from typing import Any, Iterable

from fastapi import Request
from fastapi.responses import JSONResponse


def ok(data: Any, meta: dict | None = None, message: str | None = None) -> dict:
    """Success envelope used by every endpoint."""
    body: dict[str, Any] = {"status": "success", "data": data}
    if meta is not None:
        body["meta"] = meta
    if message:
        body["message"] = message
    return body


class ApiError(Exception):
    def __init__(self, message: str, code: str = "bad_request",
                 status: int = 400, details: Any = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.details = details


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={
            "status": "error",
            "error": {"code": exc.code, "message": exc.message,
                      "details": exc.details},
        },
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {"code": "internal_error",
                      "message": "Unexpected server error.",
                      "details": str(exc)},
        },
    )


def source_tag(source: str) -> dict:
    """Standard provenance tag attached to datum throughout the API."""
    return {"source": source}


ALLOWED_SOURCES = {
    "live_api", "user_supplied", "historical_dataset", "estimated",
    "simulated", "model_prediction", "rule_based",
}
