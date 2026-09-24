"""Irrigation history, water-saving analytics, achievements, nutrients."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.responses import ApiError, ok
from app.db.session import get_db
from app.models import (Achievement, Farm, IrrigationEvent,
                        NutrientRecommendation)
from app.schemas import IrrigationEventCreate
from app.services import nutrient_engine, pipeline, water_calc

router = APIRouter(prefix="/api/v1", tags=["history", "water", "achievements"])


def _farm(db: Session, farm_id: int) -> Farm:
    farm = db.get(Farm, farm_id)
    if not farm:
        raise ApiError(f"Farm {farm_id} not found.", "not_found", 404)
    return farm


@router.get("/history/{farm_id}")
async def irrigation_history(farm_id: int, mode: str = Query("daily"),
                             days: int = Query(30, ge=7, le=365),
                             db: Session = Depends(get_db)):
    """Irrigation history + chart series with daily/weekly/monthly/cycle modes."""
    farm = _farm(db, farm_id)
    ctx = pipeline.enrich_for_engine(db, farm)
    stages = await pipeline.stage_weather(ctx)
    eto = pipeline.compute_eto(stages, ctx)[0]
    water = pipeline.compute_water_series(db, farm, days=days, eto_mm_day=eto)
    series = water_calc.rollup(water["daily"], mode)
    events = (db.query(IrrigationEvent)
              .filter(IrrigationEvent.farm_id == farm_id)
              .order_by(IrrigationEvent.ts.desc()).limit(60).all())
    goal_completion = []
    for row in water["daily"]:
        goal_completion.append({
            "date": row["date"], "goal_l": row["ai_l"],
            "actual_l": row["baseline_l"],
            "completion_pct": (round(row["baseline_l"] / row["ai_l"] * 100, 1)
                               if row["ai_l"] else
                               (0.0 if row["baseline_l"] else 100.0)),
        })
    return ok({
        "series": series,
        "mode": mode,
        "daily": water["daily"],
        "summary": water["summary"],
        "goal_completion": goal_completion,
        "events": [{
            "id": e.id, "ts": e.ts.isoformat(), "quantity_l": e.quantity_l,
            "method": e.method, "area_ha": e.area_ha,
            "moisture_before": e.moisture_before,
            "moisture_after": e.moisture_after,
            "recommendation_followed": e.recommendation_followed,
            "source": e.source,
        } for e in events],
    })


@router.post("/history/{farm_id}/events")
def record_irrigation(farm_id: int, payload: IrrigationEventCreate,
                      db: Session = Depends(get_db)):
    _farm(db, farm_id)
    data = payload.model_dump()
    data.pop("farm_id")
    ts = data.pop("ts", None) or datetime.utcnow()
    evt = IrrigationEvent(farm_id=farm_id, ts=ts, **data)
    db.add(evt)
    farm = db.get(Farm, farm_id)
    farm.last_irrigation_at = ts.isoformat()
    farm.last_irrigation_qty_l = payload.quantity_l
    if payload.moisture_after is not None:
        farm.soil_moisture_pct = payload.moisture_after
        farm.soil_moisture_source = "user_supplied"
    db.commit()
    db.refresh(evt)
    return ok({"id": evt.id, "ts": evt.ts.isoformat()},
              message="Irrigation event recorded.")


@router.get("/water-analytics/{farm_id}")
async def water_analytics(farm_id: int, mode: str = Query("daily"),
                    days: int = Query(30, ge=7, le=365),
                    db: Session = Depends(get_db)):
    """Solution 5 — water used vs conserved, differentiated series."""
    farm = _farm(db, farm_id)
    d = pipeline.enrich_for_engine(db, farm)
    stages = await pipeline.stage_weather(d)
    eto = pipeline.compute_eto(stages, d)[0]
    water = pipeline.compute_water_series(db, farm, days=days, eto_mm_day=eto)
    s = water["summary"]
    return ok({
        "mode": mode,
        "series": water_calc.rollup(water["daily"], mode),
        "daily": water["daily"],
        "summary": s,
        "series_legend": [
            {"key": "baseline_l", "label": "Baseline (traditional schedule)",
             "kind": "recorded_estimated"},
            {"key": "ai_l", "label": "AI-recommended water use",
             "kind": "model_recommendation"},
            {"key": "saved_l", "label": "Potential water savings",
             "kind": "estimated"},
            {"key": "rainwater_l", "label": "Rainwater utilised (not pumped)",
             "kind": "estimated"},
        ],
        "note": ("Recorded irrigation comes from stored events; AI use and "
                 "savings are model estimates. The same water is never counted "
                 "as both irrigation savings and rainwater conservation."),
    })


@router.get("/achievements/{farm_id}")
async def achievements(farm_id: int, db: Session = Depends(get_db)):
    farm = _farm(db, farm_id)
    data = await pipeline.full_analysis(db, farm)
    metrics = data["achievements"]
    # persist for the DB requirement
    for m in metrics:
        row = (db.query(Achievement)
               .filter(Achievement.farm_id == farm_id,
                       Achievement.metric == m["metric"]).first())
        if row:
            row.value = m["value"]; row.unit = m["unit"]
            row.history = m.get("history"); row.updated_at = datetime.utcnow()
        else:
            db.add(Achievement(farm_id=farm_id, metric=m["metric"],
                               label=m["label"], value=m["value"],
                               unit=m["unit"], history=m.get("history"),
                               source=m.get("source", "estimated")))
    db.commit()
    return ok({"metrics": metrics,
               "water_summary": data["water_analytics"]["summary"],
               "note": "Achievements are model estimates from recorded + "
                       "simulated data — see each metric's note."})


@router.get("/nutrients/{farm_id}")
def nutrients(farm_id: int, db: Session = Depends(get_db)):
    farm = _farm(db, farm_id)
    d = pipeline.enrich_for_engine(db, farm)
    result = nutrient_engine.analyze(
        d, soil_nutrients_supplied=bool(farm.soil_nutrients))
    db.add(NutrientRecommendation(
        farm_id=farm_id,
        estimated_depletion=result["estimated_depletion"],
        legumes=result["legume_recommendations"],
        manures=result["manure_recommendations"],
        compatibility_pct=result["compatibility_pct"],
        warning=result["warning"], explanation=result["explanation"],
        source="estimated"))
    db.commit()
    return ok(result)
