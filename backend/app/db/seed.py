"""Seed — crop parameters, organizations, demo farm."""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.core.config import DATA_DIR
from app.models import CropParameter, Farm, Organization
from app.services import crop_service

log = logging.getLogger("aquasense.seed")


def seed_reference(db: Session) -> None:
    """crop_parameters + organizations tables from bundled reference JSON."""
    with open(DATA_DIR / "crops.json", encoding="utf-8") as fh:
        crops = json.load(fh)
    crops.pop("_comment", None)
    for key, c in crops.items():
        total = sum(s["kc"] for s in c["stages"]) / len(c["stages"])
        row = db.query(CropParameter).filter(CropParameter.crop == key).first()
        if row is None:
            db.add(CropParameter(
                crop=key, display_name=c["display_name"],
                lifespan_days=c["lifespan_days"], base_kc=round(total, 2),
                stages=c["stages"],
                nutrient_demand=c.get("nutrient_demand_kg_ha"),
                data={"color": c.get("color"), "emoji": c.get("emoji"),
                      "notes": c.get("notes")},
                source="historical_dataset"))

    if db.query(Organization).count() == 0:
        with open(DATA_DIR / "organizations.json", encoding="utf-8") as fh:
            orgs = json.load(fh)["organizations"]
        for o in orgs:
            db.add(Organization(
                name=o["name"], org_type=o["org_type"], states=o["states"],
                services=o["services"], website=o["website"],
                verified=o["verified"], source="historical_dataset"))
    db.commit()
    log.info("Reference data seeded: %d crops, %d organizations",
             db.query(CropParameter).count(), db.query(Organization).count())


def ensure_model() -> dict:
    from app.services import ml_service
    try:
        return ml_service.ensure_model()
    except Exception as exc:  # pragma: no cover
        log.warning("ML training failed, rule-based fallback: %s", exc)
        return {"model_name": "rule_based", "data_basis": "unavailable"}


def seed_all(db: Session) -> None:
    seed_reference(db)
    ensure_model()
