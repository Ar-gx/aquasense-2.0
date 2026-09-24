"""AquaSense AI — FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.responses import ApiError, api_error_handler, unhandled_error_handler
from app.db.session import SessionLocal, init_db
from app.db.seed import seed_all
from app.routes import analytics, farms, meta, recommendation, sensors_weather

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("aquasense")

app = FastAPI(
    title="AquaSense AI",
    description="AI-powered smart irrigation & soil health optimization "
                "(PS-2B, Smart Agriculture).",
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

for router in (farms.router, sensors_weather.router, recommendation.router,
               analytics.router, meta.router):
    app.include_router(router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    log.info("AquaSense AI ready — DB: %s", settings.resolved_database_url)


@app.get("/")
def root():
    return {"status": "success",
            "data": {"app": settings.app_name, "version": settings.app_version,
                     "docs": "/docs", "health": "/api/v1/health"}}
