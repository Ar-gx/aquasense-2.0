"""Meta routes — reference data, location, organizations, calculator, impact."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import state
from app.core.config import DATA_DIR, settings
from app.core.responses import ok
from app.db.session import get_db
from app.models import Farm, Organization
from app.schemas import CalculatorRequest, ReverseRequest
from app.services import (crop_service, location_service, ml_service,
                          reference_data, soil_service, water_calc)
from app.services.irrigation_engine import METHOD_EFF

router = APIRouter(prefix="/api/v1", tags=["meta"])


@router.get("/health")
def health():
    return ok({"status": "healthy" if state.db_ready else "degraded",
               "app": settings.app_name,
               "version": settings.app_version,
               "database": {
                   "backend": settings.resolved_database_url.split(":", 1)[0],
                   "ready": state.db_ready,
                   "error": state.boot_error,
               }})


# ----------------------------- reference -----------------------------

@router.get("/crops")
def crops():
    with open(DATA_DIR / "crops.json", encoding="utf-8") as fh:
        raw = json.load(fh)
    raw.pop("_comment", None)
    return ok({"cards": crop_service.crop_cards(),
               "details": raw,
               "stages": crop_service.stage_explanations(),
               "stage_names": ["Germination", "Vegetative", "Flowering",
                               "Fruiting / Grain Filling", "Maturity"],
               "source": "historical_dataset",
               "label": "FAO-56 style crop coefficients & reference ranges"})


@router.get("/soils")
def soils():
    return ok({"cards": soil_service.texture_cards(),
               "all": soil_service.all_textures(),
               "source": "historical_dataset",
               "label": "Soil-physics reference ranges (not farm measurements)"})


@router.get("/irrigation-methods")
def irrigation_methods():
    with open(DATA_DIR / "irrigation_methods.json", encoding="utf-8") as fh:
        raw = json.load(fh)
    raw.pop("_comment", None)
    return ok(raw)


# ----------------------------- location -----------------------------

@router.get("/location/search")
async def search(q: str = Query("", min_length=1, max_length=120)):
    return ok(await location_service.search_places(q))


@router.post("/location/reverse")
async def reverse(payload: ReverseRequest):
    return ok(await location_service.reverse_lookup(payload.latitude,
                                                     payload.longitude))


# ------------------------- public datasets --------------------------

@router.get("/reference/aquastat")
def aquastat(state: str | None = None):
    data = reference_data.aquastat_payload()
    if state:
        ctx = data["state_context"].get(state)
        data["state_context"] = {state: ctx} if ctx else {}
    return ok(data)


@router.get("/reference/nass")
def nass(crop: str = "wheat"):
    return ok(reference_data.nass_payload(crop_service.crop_key(crop)))


@router.get("/data-status")
def data_status():
    """The visible data-status panel (spec section 27)."""
    m = ml_service.metrics()
    return ok({
        "sources": [
            {"name": "OpenWeather", "kind": "Current weather",
             "status": "live_api" if settings.openweather_api_key else "not_configured",
             "needs_key": True,
             "note": "API key present in .env" if settings.openweather_api_key
             else "No key configured — falls back to Open-Meteo/simulated."},
            {"name": "Open-Meteo", "kind": "Forecast (7-day hourly) + geocoding",
             "status": "live_api", "needs_key": False},
            {"name": "NASA POWER", "kind": "Historical daily meteorology",
             "status": "live_api" if settings.nasa_power_enabled else "disabled",
             "needs_key": False, "granularity": "daily ~1° grid"},
            {"name": "data.gov.in", "kind": "District daily rainfall",
             "status": "live_api" if settings.data_gov_api_key else "not_configured",
             "needs_key": True, "granularity": "district daily"},
            {"name": "SoilGrids", "kind": "Soil property point lookup",
             "status": "live_api", "needs_key": False,
             "granularity": "point, 0-5 cm"},
            {"name": "OpenStreetMap Nominatim", "kind": "Reverse/forward geocoding",
             "status": "live_api", "needs_key": False},
            {"name": "FAO AQUASTAT", "kind": "Agricultural water context",
             "status": "historical_dataset", "needs_key": False,
             "note": "Bundled reference extract with attribution."},
            {"name": "USDA NASS Quick Stats", "kind": "Crop/yield benchmarks",
             "status": "live_api" if settings.usda_nass_api_key
             else "historical_dataset",
             "needs_key": True,
             "note": "Live API with a free key; bundled NASS extract without."},
            {"name": "Soil moisture sensors", "kind": "Root-zone moisture",
             "status": "simulated",
             "note": "No IoT hardware — readings are labelled simulated or "
                     "user-supplied estimates."},
        ],
        "ml": {
            "model_name": m.get("model_name"),
            "data_basis": m.get("data_basis"),
            "metrics": {k: m.get(k) for k in
                        ("mae_pct_points", "rmse_pct_points", "r2",
                         "n_samples", "test_size", "trained_at")},
            "note": m.get("data_basis_note") or m.get("note"),
            "kinds": {
                "model_prediction": "Output of the trained regression model "
                                    "(trained on simulated data).",
                "rule_based": "Transparent water-balance formula, used when "
                              "no model artifact exists.",
                "estimated": "Reference-data calculation, not a measurement.",
                "simulated": "Deterministic demo data, never presented as live.",
            },
        },
        "savings_kinds": {
            "measured_savings": "Not available — no flow meters in this MVP.",
            "estimated_savings": "Model scenario from recorded/simulated data.",
            "illustrative_comparison": "Calculator inputs chosen by the user.",
        },
        "policy": ("The app never claims field-measured savings, lab soil "
                   "values, yield guarantees or live data where data is "
                   "simulated."),
    })


# --------------------------- organizations --------------------------

@router.get("/organizations")
def organizations(state: str | None = None):
    if db_orgs_cached() is None:
        _seed_organizations()
    q = db_orgs_list()
    if state:
        filtered = [o for o in q if not o["states"] or state in o["states"]]
        if filtered:
            q = filtered
    return ok({"organizations": q,
               "search_link": ("https://www.google.com/search?q=agricultural+"
                               "NGO+irrigation+training+"
                               + (state or "India")),
               "note": "Verified organizations with official websites only — "
                       "no phone numbers or partnerships are invented."})


_orgs_cache: list | None = None


def db_orgs_cached():
    return _orgs_cache


def db_orgs_list() -> list[dict]:
    return _orgs_cache or []


def _seed_organizations():
    global _orgs_cache
    with open(DATA_DIR / "organizations.json", encoding="utf-8") as fh:
        raw = json.load(fh)["organizations"]
    _orgs_cache = [{
        "name": o["name"], "org_type": o["org_type"],
        "states": o["states"], "services": o["services"],
        "website": o["website"], "verified": o["verified"],
        "note": o.get("note"), "source": "historical_dataset",
    } for o in raw]


# ----------------------------- calculator ---------------------------

@router.post("/water-calculator")
def water_calculator(payload: CalculatorRequest):
    return ok(water_calc.calculator(payload.baseline_per_ha_l,
                                    payload.ai_per_ha_l, payload.area_ha))


# ------------------------------- impact -----------------------------

@router.get("/impact")
async def impact(db: Session = Depends(get_db)):
    """Landing-page 'Every Drop Counts' numbers — derived from the actual
    demo farm model output, each labelled with its basis."""
    farm = (db.query(Farm).filter(Farm.is_demo.is_(True)).first()
            or db.query(Farm).order_by(Farm.id).first())
    if not farm:
        return ok({"available": False,
                   "note": "No farm analysed yet — load the Demo Farm first."})
    from app.services import pipeline as pl
    data = await pl.full_analysis(db, farm)
    s = data["water_analytics"]["summary"]
    return ok({
        "available": True,
        "farm_area_ha": farm.area_ha,
        "water_saved_per_ha_l": s["saved_per_ha_l"],
        "water_saved_total_l": s["saved_l"],
        "reduction_pct": s["saved_pct"],
        "irrigation_efficiency_pct": round(
            (s.get("irrigation_efficiency_ai") or 0.45) * 100),
        "crop_water_adequacy_pct": next(
            (a["value"] for a in data["achievements"]
             if a["metric"] == "crop_water_adequacy"), None),
        "rainwater_conserved_l": s["rainwater_conserved_l"],
        "basis": s["label"],
        "series": s,
    })
