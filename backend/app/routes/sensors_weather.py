"""Sensor + weather + prediction routes."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.responses import ApiError, ok
from app.db.session import get_db
from app.models import Farm, Prediction, SensorReading, WeatherReading
from app.schemas import SensorReadingCreate
from app.services import crop_service, ml_service, pipeline, soil_service

router = APIRouter(prefix="/api/v1", tags=["sensors", "weather", "predict"])


def _farm(db: Session, farm_id: int) -> Farm:
    farm = db.get(Farm, farm_id)
    if not farm:
        raise ApiError(f"Farm {farm_id} not found.", "not_found", 404)
    return farm


@router.post("/sensors/readings")
def create_reading(payload: SensorReadingCreate,
                   db: Session = Depends(get_db)):
    if not db.get(Farm, payload.farm_id):
        raise ApiError(f"Farm {payload.farm_id} not found.", "not_found", 404)
    data = payload.model_dump()
    ts = data.pop("ts", None) or datetime.utcnow()
    reading = SensorReading(ts=ts, **data)
    db.add(reading)
    # keep the farm's "current" moisture in sync with the newest reading
    farm = db.get(Farm, payload.farm_id)
    if payload.soil_moisture_pct is not None:
        farm.soil_moisture_pct = payload.soil_moisture_pct
        farm.soil_moisture_source = payload.source
    db.commit()
    db.refresh(reading)
    return ok({"id": reading.id, "ts": reading.ts.isoformat(),
               "source": reading.source},
              message="Reading stored.")


@router.get("/sensors/readings/{farm_id}")
def list_readings(farm_id: int, days: int = Query(30, ge=1, le=365),
                  db: Session = Depends(get_db)):
    _farm(db, farm_id)
    from datetime import timedelta
    since = datetime.utcnow() - timedelta(days=days)
    rows = (db.query(SensorReading)
            .filter(SensorReading.farm_id == farm_id,
                    SensorReading.ts >= since)
            .order_by(SensorReading.ts.asc()).all())
    return ok([{
        "ts": r.ts.isoformat(),
        "soil_moisture_pct": r.soil_moisture_pct,
        "soil_temp_c": r.soil_temp_c, "air_temp_c": r.air_temp_c,
        "humidity_pct": r.humidity_pct, "rainfall_mm": r.rainfall_mm,
        "source": r.source,
    } for r in rows],
        meta={"count": len(rows),
              "note": "Readings with source='simulated' are demo data."})


@router.get("/weather/{farm_id}")
async def get_weather(farm_id: int, db: Session = Depends(get_db)):
    """Current + 24h + 3-day + 7-day forecast + 30-day history with a
    per-source data-status block."""
    farm = _farm(db, farm_id)
    d = pipeline.enrich_for_engine(db, farm)
    stages = await pipeline.stage_weather(d)

    status = [
        {"source": "OpenWeather / Open-Meteo",
         "kind": "Current conditions",
         "status": stages["current"].get("source"),
         "granularity": "instant",
         "label": stages["current"].get("source_label", "simulated demo")},
        {"source": "Open-Meteo",
         "kind": "Forecast (hourly/daily, 7 day)",
         "status": stages["forecast"].get("source"),
         "granularity": "hourly + daily",
         "label": stages["forecast"].get("source_label", "simulated demo")},
        {"source": "NASA POWER",
         "kind": "Historical weather",
         "status": stages["history"]["nasa_power"].get("source"),
         "granularity": "daily, ~1° grid cell",
         "label": stages["history"]["nasa_power"].get("source_label", "n/a")},
        {"source": "data.gov.in",
         "kind": "District daily rainfall",
         "status": stages["history"]["district_rainfall"].get("source"),
         "granularity": "district daily",
         "label": stages["history"]["district_rainfall"].get(
             "source_label", "n/a")},
        {"source": "Farmer / sensor",
         "kind": "Soil moisture",
         "status": farm.soil_moisture_source or "user_supplied",
         "granularity": "point reading",
         "label": "Supplied by user or labelled simulated"},
        {"source": "FAO crop coefficients (Kc)",
         "kind": "Crop water demand model",
         "status": "historical_dataset",
         "granularity": "crop + growth stage",
         "label": "FAO-56 style reference coefficients"},
        {"source": "ML model",
         "kind": "Soil moisture +24h prediction",
         "status": "model_prediction",
         "granularity": "24-hour horizon",
         "label": ml_service.metrics().get("model_name", "rule-based"),
         "data_basis": ml_service.metrics().get("data_basis")},
        {"source": "Irrigation engine",
         "kind": "Recommendations / savings",
         "status": "estimated",
         "granularity": "daily",
         "label": "Hybrid ML + rules — model scenario estimates"},
    ]
    return ok({
        "current": stages["current"],
        "forecast": stages["forecast"],
        "history": stages["history"],
        "data_status": status,
    })


@router.post("/predict/{farm_id}")
async def run_prediction(farm_id: int, db: Session = Depends(get_db)):
    """Run the +24h soil-moisture prediction and persist it."""
    farm = _farm(db, farm_id)
    d = pipeline.enrich_for_engine(db, farm)
    stages = await pipeline.stage_weather(d)
    soil_stage = await pipeline.stage_soil(d)

    crop_key = crop_service.crop_key(farm.crop_name)
    state = {
        "soil_moisture": farm.soil_moisture_pct
        if farm.soil_moisture_pct is not None else 30.0,
        "temp_c": stages["current"].get("temp_c") or 30.0,
        "humidity": stages["current"].get("humidity_pct") or 60.0,
        "rainfall_mm": stages["current"].get("precip_mm_today") or 0.0,
        "wind_kmh": stages["current"].get("wind_kmh") or 10.0,
        "soil_type": farm.soil_type, "crop": crop_key,
        "stage_code": soil_stage["stage"] and crop_service.current_stage(
            crop_service.get_crop(crop_key), soil_stage["growth_day"])[0],
        "forecast_rain_mm": (stages["forecast"].get("hourly") or [{}])[0]
        .get("precip_mm", 0.0) if stages["forecast"].get("hourly") else 0.0,
    }
    pred = ml_service.predict_24h(state)
    trajectory = ml_service.predict_trajectory(
        state, stages["forecast"].get("daily", []), steps=7)

    record = Prediction(
        farm_id=farm.id, horizon_hours=24,
        predicted_moisture_pct=pred["predicted_moisture_pct"],
        model_name=pred["model_name"], model_kind=pred["model_kind"],
        metrics=pred.get("metrics"), features=state, trajectory=trajectory,
        source=pred["source"])
    db.add(record)
    db.commit()
    db.refresh(record)

    tex = soil_service.get_texture(farm.soil_type)
    return ok({
        "prediction_id": record.id,
        "current_moisture_pct": state["soil_moisture"],
        "predicted_moisture_pct": pred["predicted_moisture_pct"],
        "horizon_hours": 24,
        "model_name": pred["model_name"],
        "model_kind": pred["model_kind"],
        "metrics": pred.get("metrics"),
        "label": pred["label"],
        "source": pred["source"],
        "trajectory": trajectory,
        "thresholds": {
            "field_capacity_pct": tex["fc"], "wilting_point_pct": tex["wp"],
            "saturation_pct": tex["sat"],
            "stress_threshold_pct": soil_stage["status"].get(
                "stress_threshold_pct"),
        },
        "actual_measurement": farm.soil_moisture_pct,
        "actual_source": farm.soil_moisture_source,
        "note": ("Prediction horizon beyond 72 h is an extended outlook, not "
                 "a validated forecast."),
    }, meta=ml_service.metrics())


@router.get("/predict/{farm_id}")
def last_prediction(farm_id: int, db: Session = Depends(get_db)):
    _farm(db, farm_id)
    rec = (db.query(Prediction).filter(Prediction.farm_id == farm_id)
           .order_by(Prediction.created_at.desc()).first())
    if not rec:
        raise ApiError("No prediction yet — POST /api/v1/predict/{farm_id}.",
                       "not_found", 404)
    return ok({
        "prediction_id": rec.id, "created_at": rec.created_at.isoformat(),
        "predicted_moisture_pct": rec.predicted_moisture_pct,
        "model_name": rec.model_name, "model_kind": rec.model_kind,
        "metrics": rec.metrics, "trajectory": rec.trajectory,
        "source": rec.source,
    }, meta=ml_service.metrics())
