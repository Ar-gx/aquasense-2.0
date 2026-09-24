"""Recommendation + dashboard routes."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.responses import ApiError, ok
from app.db.session import get_db
from app.models import Farm, IrrigationEvent, Recommendation
from app.services import pipeline

router = APIRouter(prefix="/api/v1", tags=["recommendation", "dashboard"])


def _farm(db: Session, farm_id: int) -> Farm:
    farm = db.get(Farm, farm_id)
    if not farm:
        raise ApiError(f"Farm {farm_id} not found.", "not_found", 404)
    return farm


@router.get("/recommendation/{farm_id}")
async def get_recommendation(farm_id: int, db: Session = Depends(get_db)):
    """Full 12-step irrigation optimization result (persisted)."""
    farm = _farm(db, farm_id)
    d = pipeline.enrich_for_engine(db, farm)
    stages = await pipeline.stage_weather(d)
    recorded = sum(e.quantity_l for e in db.query(IrrigationEvent)
                   .filter(IrrigationEvent.farm_id == farm.id).all())
    reco = __import__("app.services.irrigation_engine", fromlist=["optimize"]) \
        .optimize(d, stages["current"], stages["forecast"], recorded,
                  eto_override=pipeline.compute_eto(stages, d))

    db.add(Recommendation(
        farm_id=farm.id,
        irrigation_required=reco["irrigation_required"],
        recommended_at=reco["recommended_time"],
        quantity_l=float(reco["quantity_l"]),
        quantity_l_per_ha=float(reco["quantity_l_per_ha"]),
        reason=reco["reason"], confidence=reco["confidence"],
        payload=reco, source=reco["source"]))
    db.commit()
    return ok(reco)


@router.get("/dashboard/{farm_id}")
async def dashboard(farm_id: int, db: Session = Depends(get_db)):
    """Everything the main dashboard needs in a single payload."""
    farm = _farm(db, farm_id)
    data = await pipeline.full_analysis(db, farm)

    # persist latest prediction + recommendation rows
    from app.models import Prediction, Recommendation as Rec
    from app.services import ml_service
    reco = data["recommendation"]
    state = {
        "soil_moisture": reco["soil_moisture_pct"],
        "temp_c": data["weather"]["current"].get("temp_c") or 30.0,
        "humidity": data["weather"]["current"].get("humidity_pct") or 60.0,
        "rainfall_mm": data["weather"]["current"].get("precip_mm_today") or 0.0,
        "wind_kmh": data["weather"]["current"].get("wind_kmh") or 10.0,
        "soil_type": farm.soil_type,
        "crop": data["farm"]["crop_name"], "stage_code": 2,
    }
    pred = ml_service.predict_24h(state)
    db.add(Prediction(
        farm_id=farm.id, horizon_hours=24,
        predicted_moisture_pct=pred["predicted_moisture_pct"],
        model_name=pred["model_name"], model_kind=pred["model_kind"],
        metrics=pred.get("metrics"), features=state,
        trajectory=data["recommendation"].get("predictions") and
        await _traj(state, data),
        source=pred["source"]))
    db.add(Rec(
        farm_id=farm.id, irrigation_required=reco["irrigation_required"],
        recommended_at=reco["recommended_time"],
        quantity_l=float(reco["quantity_l"]),
        quantity_l_per_ha=float(reco["quantity_l_per_ha"]),
        reason=reco["reason"], confidence=reco["confidence"],
        payload=reco, source=reco["source"]))
    db.commit()

    summary = data["water_analytics"]["summary"]
    return ok({
        "farm": data["farm"],
        "optimal_irrigation_plan": {
            "irrigation_required": reco["irrigation_required"],
            "status": reco["status"], "status_label": reco["status_label"],
            "recommended_time": reco["recommended_time"],
            "quantity_l": reco["quantity_l"],
            "quantity_l_per_ha": reco["quantity_l_per_ha"],
            "estimated_water_saved_l": (summary["saved_l"]
                                        + summary["rainwater_conserved_l"]),
            "water_savings_note": summary["label"],
            "crop_water_adequacy": next(
                (a["value"] for a in data["achievements"]
                 if a["metric"] == "crop_water_adequacy"), None),
            "reason": reco["reason"],
            "confidence": reco["confidence"],
            "limitations": reco["limitations"],
        },
        "recommendation": reco,
        "prediction": {
            "current_moisture_pct": reco["soil_moisture_pct"],
            "predicted_moisture_pct": pred["predicted_moisture_pct"],
            "model_name": pred["model_name"],
            "model_kind": pred["model_kind"],
            "metrics": pred.get("metrics"),
            "source": pred["source"],
        },
        "current_moisture": data["soil"]["status"],
        "weather_current": data["weather"]["current"],
        "forecast": data["weather"]["forecast"],
        "growth_stage": reco["growth_stage"],
        "crop_lifecycle": data["crop_lifecycle"],
        "daily_goal_l": reco["daily_goal_l"],
        "remaining_daily_goal_l": reco["remaining_daily_goal_l"],
        "water_savings": summary,
        "water_analytics": data["water_analytics"],
        "warnings": data["warnings"],
        "nutrients": data["nutrients"],
        "achievements": data["achievements"],
        "yield_reference": data["yield_reference"],
        "data_status": data["weather"]["history"] and [
            {"source": "Weather", "status": data["weather"]["current"].get("source"),
             "label": data["weather"]["current"].get("source_label")},
            {"source": "Forecast", "status": data["weather"]["forecast"].get("source"),
             "label": data["weather"]["forecast"].get("source_label")},
            {"source": "Soil moisture",
             "status": reco["soil_moisture_source"],
             "label": "user supplied" if reco["soil_moisture_source"] == "user_supplied"
             else "estimated (no sensor)"},
            {"source": "ML model", "status": "model_prediction",
             "label": pred["model_name"],
             "data_basis": (pred.get("metrics") or {}).get("data_basis",
                                                           "simulated")},
            {"source": "Water savings", "status": "estimated",
             "label": summary.get("label")},
        ],
        "generated_at": datetime.utcnow().isoformat() + "Z",
    })


async def _traj(state, data):
    from app.services import ml_service
    return ml_service.predict_trajectory(
        state, data["weather"]["forecast"].get("daily", []), steps=7)
