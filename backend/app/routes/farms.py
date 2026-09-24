"""Farms routes — create, read, update + the one-click Demo Farm."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.responses import ApiError, ok
from app.db.session import get_db
from app.models import CropParameter, Farm, IrrigationEvent, SensorReading
from app.schemas import FarmCreate, FarmUpdate
from app.services import crop_service, pipeline, soil_service
from app.services.irrigation_engine import METHOD_EFF

router = APIRouter(prefix="/api/v1", tags=["farms"])


def get_farm_or_404(db: Session, farm_id: int) -> Farm:
    farm = db.get(Farm, farm_id)
    if not farm:
        raise ApiError(f"Farm {farm_id} not found.", "not_found", 404)
    return farm


@router.post("/farms")
def create_farm(payload: FarmCreate, db: Session = Depends(get_db)):
    farm = Farm(**payload.model_dump())
    if payload.soil_moisture_pct is not None:
        farm.soil_moisture_source = "user_supplied"
    elif "soil_moisture" in (payload.unknown_fields or []):
        farm.soil_moisture_pct = None
        farm.soil_moisture_source = "estimated"
    db.add(farm)
    db.commit()
    db.refresh(farm)
    # Seed a labelled simulated sensor series so charts/history work instantly.
    _seed_history(db, farm)
    return ok(pipeline.farm_public(farm),
              message="Farm created. Sensor history seeded with labelled "
                      "simulated data.")


@router.get("/farms")
def list_farms(db: Session = Depends(get_db)):
    farms = db.query(Farm).order_by(Farm.id.desc()).all()
    return ok([pipeline.farm_public(f) for f in farms])


@router.get("/farms/{farm_id}")
def get_farm(farm_id: int, db: Session = Depends(get_db)):
    return ok(pipeline.farm_public(get_farm_or_404(db, farm_id)))


@router.patch("/farms/{farm_id}")
def update_farm(farm_id: int, payload: FarmUpdate,
                db: Session = Depends(get_db)):
    farm = get_farm_or_404(db, farm_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("soil_moisture_pct") is not None:
        data.setdefault("soil_moisture_source", "user_supplied")
    for k, v in data.items():
        setattr(farm, k, v)
    farm.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(farm)
    return ok(pipeline.farm_public(farm), message="Farm updated.")


@router.post("/farms/demo")
def load_demo_farm(db: Session = Depends(get_db)):
    """One-click demo — deterministic, fully labelled simulated data."""
    demo = db.query(Farm).filter(Farm.is_demo.is_(True)).first()
    if demo:
        return ok(pipeline.farm_public(demo),
                  message="Demo farm already present — loading it.")

    import json
    from app.core.config import DATA_DIR
    with open(DATA_DIR / "demo_farm.json", encoding="utf-8") as fh:
        spec = json.load(fh)["farm"]

    sow = date.today() - timedelta(days=spec["sowing_date_offset_days"])
    last_irr = (datetime.utcnow() - timedelta(
        days=spec["last_irrigation_offset_days"])).replace(
        hour=6, minute=30, second=0, microsecond=0)
    farm = Farm(
        name=spec["name"], is_demo=True,
        crop_name=spec["crop_name"], sowing_date=sow.isoformat(),
        prev_irrigation_info=spec["prev_irrigation_info"],
        taluk=spec["taluk"], district=spec["district"], state=spec["state"],
        latitude=spec["latitude"], longitude=spec["longitude"],
        location_precision=spec["location_precision"],
        growth_stage=spec["growth_stage"], area_ha=spec["area_ha"],
        soil_type=spec["soil_type"],
        soil_moisture_pct=spec["soil_moisture_pct"],
        soil_moisture_source=spec["soil_moisture_source"],
        irrigation_method=spec["irrigation_method"],
        last_irrigation_at=last_irr.isoformat(),
        last_irrigation_qty_l=spec["last_irrigation_qty_l"],
        previous_crop=spec["previous_crop"],
        soil_nutrients=spec["soil_nutrients"],
        unknown_fields=spec["unknown_fields"],
        budget_hint=spec["budget_hint"],
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)

    # 30 days of simulated sensors + traditional irrigation events
    tex = soil_service.get_texture(farm.soil_type)
    info = _seed_history(db, farm, force=True, tex=tex)
    _persist_run(db, farm)
    return ok(pipeline.farm_public(farm),
              message="Demo farm loaded: Wheat, flowering, loamy, 2.5 ha, "
                      "24% moisture with 30 days of labelled simulated data.",
              meta={"history": info, "demo": True})


def _seed_history(db: Session, farm: Farm, force: bool = False,
                  tex: dict | None = None) -> dict:
    from app.services.sensor_sim import generate_history
    if not force and db.query(SensorReading).filter(
            SensorReading.farm_id == farm.id).count():
        return {"created": False}
    tex = tex or soil_service.get_texture(farm.soil_type)
    crop = crop_service.get_crop(crop_service.crop_key(farm.crop_name))
    day = 0
    if farm.sowing_date:
        try:
            day = max(0, (date.today()
                          - crop_service.parse_date(farm.sowing_date)).days)
        except Exception:
            pass
    _, stage = crop_service.current_stage(crop, day)
    eff = METHOD_EFF.get((farm.irrigation_method or "flood").lower(), 0.45)
    return generate_history(
        db, farm.id, farm.soil_type or "loamy", farm.area_ha or 1.0,
        farm.irrigation_method or "flood", eff,
        farm.soil_moisture_pct if farm.soil_moisture_pct is not None else 28.0,
        tex["fc"], tex["wp"], eto_mm_day=5.0, kc_now=stage["kc"], days=30,
        irrigation_interval=5,
        irrigation_qty_l=farm.last_irrigation_qty_l or 1_300_000)


def _persist_run(db: Session, farm: Farm) -> None:
    """Persist prediction + recommendation rows for the demo/farm."""
    import asyncio
    from app.services import irrigation_engine, ml_service
    from app.models import Prediction, Recommendation

    farm_dict = pipeline.enrich_for_engine(db, farm)
    try:
        weather = asyncio.get_event_loop().run_until_complete(
            pipeline.stage_weather(farm_dict))
    except RuntimeError:
        weather = asyncio.new_event_loop().run_until_complete(
            pipeline.stage_weather(farm_dict))

    state = {
        "soil_moisture": farm_dict.get("soil_moisture_pct") or 30.0,
        "temp_c": weather["current"].get("temp_c") or 30.0,
        "humidity": weather["current"].get("humidity_pct") or 60.0,
        "rainfall_mm": weather["current"].get("precip_mm_today") or 0.0,
        "wind_kmh": weather["current"].get("wind_kmh") or 10.0,
        "soil_type": farm_dict.get("soil_type"),
        "crop": crop_service.crop_key(farm_dict.get("crop_name")),
        "stage_code": 2, "forecast_rain_mm": 0.0,
    }
    pred = ml_service.predict_24h(state)
    trajectory = ml_service.predict_trajectory(state,
                                               weather["forecast"].get("daily", []))
    db.add(Prediction(
        farm_id=farm.id, horizon_hours=24,
        predicted_moisture_pct=pred["predicted_moisture_pct"],
        model_name=pred["model_name"], model_kind=pred["model_kind"],
        metrics=pred.get("metrics"), features=state, trajectory=trajectory,
        source=pred["source"]))

    reco = irrigation_engine.optimize(farm_dict, weather["current"],
                                      weather["forecast"],
                                      eto_override=pipeline.compute_eto(
                                          weather, farm_dict))
    db.add(Recommendation(
        farm_id=farm.id,
        irrigation_required=reco["irrigation_required"],
        recommended_at=reco["recommended_time"],
        quantity_l=float(reco["quantity_l"]),
        quantity_l_per_ha=float(reco["quantity_l_per_ha"]),
        reason=reco["reason"], confidence=reco["confidence"],
        payload=reco, source=reco["source"]))
    db.commit()


@router.get("/farms/{farm_id}/events")
def farm_events(farm_id: int, db: Session = Depends(get_db)):
    get_farm_or_404(db, farm_id)
    events = (db.query(IrrigationEvent)
              .filter(IrrigationEvent.farm_id == farm_id)
              .order_by(IrrigationEvent.ts.desc()).limit(100).all())
    return ok([{
        "id": e.id, "ts": e.ts.isoformat(), "quantity_l": e.quantity_l,
        "method": e.method, "area_ha": e.area_ha,
        "moisture_before": e.moisture_before,
        "moisture_after": e.moisture_after,
        "recommendation_followed": e.recommendation_followed,
        "source": e.source,
    } for e in events])
