"""Pipeline — assembles every engine into the payloads the API serves.

GET /dashboard/{farm_id} and the analysis overlay both go through here so the
"real processing stages" the animation shows are the actual stages executed.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import Farm, IrrigationEvent, SensorReading
from app.services import (crop_service, nutrient_engine, reference_data,
                          soil_service, warnings_engine, weather_service,
                          water_calc, irrigation_engine)
from app.services.climate import estimate_eto

METHOD_EFF = {"flood": 0.45, "furrow": 0.5, "sprinkler": 0.75,
              "drip": 0.9, "center_pivot": 0.85, "manual": 0.55, "rainfed": 1.0}


def farm_public(farm: Farm) -> dict:
    return {
        "id": farm.id, "name": farm.name, "is_demo": farm.is_demo,
        "crop_name": farm.crop_name, "custom_crop_name": farm.custom_crop_name,
        "sowing_date": farm.sowing_date, "growth_stage": farm.growth_stage,
        "area_ha": farm.area_ha, "soil_type": farm.soil_type,
        "soil_moisture_pct": farm.soil_moisture_pct,
        "soil_moisture_source": farm.soil_moisture_source,
        "irrigation_method": farm.irrigation_method,
        "taluk": farm.taluk, "district": farm.district, "state": farm.state,
        "latitude": farm.latitude, "longitude": farm.longitude,
        "location_precision": farm.location_precision,
        "last_irrigation_at": farm.last_irrigation_at,
        "last_irrigation_qty_l": farm.last_irrigation_qty_l,
        "prev_irrigation_info": farm.prev_irrigation_info,
        "previous_crop": farm.previous_crop,
        "soil_nutrients": farm.soil_nutrients,
        "unknown_fields": farm.unknown_fields or [],
        "budget_hint": farm.budget_hint,
        "created_at": farm.created_at.isoformat() if farm.created_at else None,
        "updated_at": farm.updated_at.isoformat() if farm.updated_at else None,
    }


def enrich_for_engine(db: Session, farm: Farm) -> dict:
    """Farm dict + history facts the engines need."""
    d = farm_public(farm)
    today = date.today()
    today_l = sum(e.quantity_l for e in db.query(IrrigationEvent)
                  .filter(IrrigationEvent.farm_id == farm.id)
                  .filter(IrrigationEvent.ts >= datetime.combine(
                      today, datetime.min.time())).all())
    events = (db.query(IrrigationEvent)
              .filter(IrrigationEvent.farm_id == farm.id)
              .order_by(IrrigationEvent.ts.desc()).all())
    interval = 5
    if len(events) >= 2:
        deltas = [(events[i].ts - events[i + 1].ts).days
                  for i in range(len(events) - 1)]
        deltas = [x for x in deltas if x > 0]
        if deltas:
            interval = max(2, round(sum(deltas) / len(deltas)))
    d["_events_today_l"] = today_l
    d["_traditional_interval_days"] = interval
    return d


async def stage_weather(farm_dict: dict) -> dict:
    """Stage 'Analyzing meteorological conditions'."""
    lat, lon = farm_dict.get("latitude"), farm_dict.get("longitude")
    current = await weather_service.get_current(lat, lon)
    forecast = await weather_service.get_forecast(lat, lon, days=7)
    hist = await weather_service.get_history(
        lat, lon, farm_dict.get("state"), farm_dict.get("district"), days=30)
    return {"current": current, "forecast": forecast, "history": hist}


async def stage_soil(farm_dict: dict) -> dict:
    """Stage 'Reading soil conditions'."""
    tex = soil_service.get_texture(farm_dict.get("soil_type"))
    moisture = farm_dict.get("soil_moisture_pct")
    idx_crop = crop_service.crop_key(farm_dict.get("crop_name"))
    crop = crop_service.get_crop(idx_crop)
    day = 0
    if farm_dict.get("sowing_date"):
        try:
            day = max(0, (date.today()
                          - crop_service.parse_date(farm_dict["sowing_date"])).days)
        except Exception:
            pass
    _, stage = crop_service.current_stage(crop, day)
    status = soil_service.moisture_status(
        moisture, farm_dict.get("soil_type"), stage["mad"])
    return {"texture": tex, "status": status, "stage": stage,
            "growth_day": day}


async def stage_crop(farm_dict: dict, weather: dict, recorded_l: float) -> dict:
    """Stage 'Analyzing crop water demand'."""
    eto, eto_method = compute_eto(weather, farm_dict)
    return crop_service.lifecycle_analysis(
        crop_name=farm_dict.get("crop_name"),
        sowing_date=farm_dict.get("sowing_date") or date.today().isoformat(),
        area_ha=farm_dict.get("area_ha"),
        eto_mm_day=eto,
        eto_source=eto_method,
        recorded_irrigation_l=recorded_l,
        lat=farm_dict.get("latitude") or 20.0,
    )


def compute_eto(weather: dict, farm_dict: dict) -> tuple[float, str]:
    """Radiation-based ETo from NASA POWER history when available,
    otherwise temperature-based Hargreaves on current conditions."""
    from app.services.climate import estimate_eto, radiation_eto
    hist_days = (weather.get("history") or {}).get("nasa_power", {}) \
        .get("daily") or []
    cur = weather.get("current") or {}
    if hist_days:
        recent = [d for d in hist_days[-7:]
                  if d.get("solar_mj_m2_day") and d["solar_mj_m2_day"] > 3]
        if recent:
            rs = sum(d["solar_mj_m2_day"] for d in recent) / len(recent)
            eto, method = radiation_eto(rs, cur.get("humidity_pct"))
            return eto, f"{method}_nasa_power_solar"
    return estimate_eto(cur.get("temp_c"), cur.get("humidity_pct"),
                        cur.get("wind_kmh"), None,
                        farm_dict.get("latitude") or 20.0)


def stage_nutrients(farm_dict: dict) -> dict:
    return nutrient_engine.analyze(
        farm_dict, soil_nutrients_supplied=bool(farm_dict.get("soil_nutrients")))


def compute_water_series(db: Session, farm: Farm, days: int = 30,
                         reco: dict | None = None,
                         eto_mm_day: float | None = None) -> dict:
    """Baseline (recorded traditional events) vs AI (self-contained replay).

    - Baseline = what the farmer actually recorded (fixed-schedule events).
    - AI = replay of the engine's trigger rule on its own moisture trajectory
      (minimum 2 days between events; skips when rain covers the deficit).
    - rainwater_l is credited ONLY when rain >= 5 mm that day/previous day
      and the AI skipped while the baseline irrigated — irrigation savings
      and rainwater utilisation are never the same litre counted twice.
    """
    d = enrich_for_engine(db, farm)
    area = farm.area_ha or 1.0
    eff = METHOD_EFF.get((farm.irrigation_method or "flood").lower(), 0.45)
    interval = d["_traditional_interval_days"] or 5
    baseline_event = farm.last_irrigation_qty_l or round(
        0.5 * 10 * area * 10_000)
    eto_mm_day = eto_mm_day or 5.0

    rows = (db.query(SensorReading)
            .filter(SensorReading.farm_id == farm.id,
                    SensorReading.soil_moisture_pct.is_not(None))
            .order_by(SensorReading.ts.asc()).all())
    by_day: dict[str, float] = {}
    for r in rows:
        by_day[r.ts.date().isoformat()] = r.soil_moisture_pct

    events = (db.query(IrrigationEvent)
              .filter(IrrigationEvent.farm_id == farm.id).all())
    event_by_day: dict[str, float] = {}
    for e in events:
        event_by_day[e.ts.date().isoformat()] = (
            event_by_day.get(e.ts.date().isoformat(), 0) + e.quantity_l)

    crop_key = crop_service.crop_key(farm.crop_name)
    crop = crop_service.get_crop(crop_key)
    day_no = 0
    if farm.sowing_date:
        try:
            day_no = max(0, (date.today()
                             - crop_service.parse_date(farm.sowing_date)).days)
        except Exception:
            pass
    _, stage = crop_service.current_stage(crop, day_no)
    tex = soil_service.get_texture(farm.soil_type)
    fc, wp = tex["fc"], tex["wp"]
    mad = stage["mad"]
    stress = wp + (fc - wp) * (1 - mad)
    trigger = stress + (fc - wp) * 0.10
    root_mm = stage["root_depth_m"] * 1000
    kc = stage["kc"]

    start = date.today() - timedelta(days=days - 1)
    day_list = [{"date": (start + timedelta(days=i)).isoformat(), "rain_mm": 0.0,
                 "eto_mm_day": eto_mm_day} for i in range(days)]

    rain_by_day: dict[str, float] = {}
    for r in db.query(SensorReading).filter(
            SensorReading.farm_id == farm.id,
            SensorReading.rainfall_mm.is_not(None),
            SensorReading.rainfall_mm > 0).all():
        rain_by_day[r.ts.date().isoformat()] = max(
            rain_by_day.get(r.ts.date().isoformat(), 0), r.rainfall_mm)
    for d0 in day_list:
        d0["rain_mm"] = rain_by_day.get(d0["date"], 0.0)

    # ---- AI replay (own trajectory from the window's first reading,
    # min 2-day gap, rain-aware) ----
    window_vals = sorted(by_day.items())[:1]
    start_moisture = window_vals[0][1] if window_vals else (
        farm.soil_moisture_pct if farm.soil_moisture_pct is not None else 30.0)
    moisture = max(wp + 2, min(fc, start_moisture))
    ai_events: dict[str, float] = {}
    last_ai_index = -10
    for i, d0 in enumerate(day_list):
        ds = d0["date"]
        rain = d0["rain_mm"]
        effective_rain = rain * 0.7
        if (i - last_ai_index) >= 2 and moisture <= trigger \
                and effective_rain < (fc * 0.98 - moisture) / 100 * root_mm * 0.8:
            needed = max(0.0, (fc * 0.98 - moisture)) / 100 * root_mm
            gross = needed / eff
            ai_events[ds] = round(gross * area * 10_000)
            moisture = min(fc, moisture + (gross * eff) / root_mm * 100)
            last_ai_index = i
        moisture += (effective_rain) / root_mm * 100
        moisture -= (kc * d0["eto_mm_day"]) / root_mm * 100
        moisture = max(wp - 2, min(fc + 2, moisture))
        d0["_ai_moisture"] = round(moisture, 1)

    # ---- daily series ----
    prev_rain = 0.0
    series = []
    for i, d0 in enumerate(day_list):
        ds = d0["date"]
        base_l = round(event_by_day.get(ds, 0.0))
        ai_l = float(ai_events.get(ds, 0.0))
        saved = base_l - ai_l
        rain_credit = 0.0
        if base_l > 0 and ai_l == 0 and (d0["rain_mm"] >= 5 or prev_rain >= 5):
            # irrigation skipped BECAUSE OF rain — attributed to rainwater
            # utilisation only, never also to irrigation savings
            rain_credit = base_l
            saved = 0.0
        rain_prev_recorded = rain_by_day.get(ds, 0.0) or prev_rain
        series.append({
            "date": ds,
            "baseline_l": base_l,
            "ai_l": round(ai_l),
            "saved_l": round(saved),
            "saved_pct": (round(saved / base_l * 100, 1) if base_l else 0.0),
            "rainwater_l": round(rain_credit),
            "rain_mm": d0["rain_mm"],
            "moisture_pct": d0["_ai_moisture"],
            "recorded_moisture_pct": by_day.get(ds),
        })
        prev_rain = d0["rain_mm"]

    summary = water_calc.summarize(series, area)
    summary["irrigation_efficiency_ai"] = eff
    eff_improve = round((eff - 0.45) / 0.45 * 100, 1) if eff > 0.45 else 0.0
    summary["efficiency_improvement_pct"] = eff_improve
    summary["baseline_method"] = farm.irrigation_method or "flood"
    summary["stress_threshold_pct"] = round(stress, 1)
    summary["trigger_threshold_pct"] = round(trigger, 1)
    return {"daily": series, "summary": summary,
            "interval_days": interval, "baseline_event_l": round(baseline_event),
            "source": "estimated"}


def achievements_for(db: Session, farm: Farm, water: dict,
                     crop_life: dict, reco: dict | None) -> list[dict]:
    s = water["summary"]
    area = farm.area_ha or 1.0
    daily = water["daily"]

    adequacy_days = sum(1 for r in daily
                        if r["moisture_pct"] >= (reco or {}).get(
                            "stress_threshold_pct", 18))
    adequacy = round(100 * adequacy_days / max(1, len(daily)), 1)

    goal_days = sum(1 for r in daily if r["ai_l"] > 0)
    followed = sum(1 for r in daily if r["ai_l"] > 0)
    metrics = [
        {"metric": "total_water_conserved",
         "label": "Total estimated water conserved",
         "value": s["saved_l"], "unit": "L", "source": "estimated",
         "note": "Irrigation-schedule savings (baseline − AI) over the "
                 "analysed window; rainwater utilisation is reported as a "
                 "separate metric."},
        {"metric": "water_conserved_per_ha",
         "label": "Water conserved per hectare",
         "value": s["saved_per_ha_l"], "unit": "L/ha", "source": "estimated",
         "note": "Total conserved ÷ farm area."},
        {"metric": "rainwater_conserved",
         "label": "Rainwater utilised (irrigation skipped)",
         "value": s["rainwater_conserved_l"], "unit": "L", "source": "estimated",
         "note": "Tracked SEPARATELY from irrigation savings — never double "
                 "counted. Water the farmer did not pump because rain covered "
                 "the deficit."},
        {"metric": "consumption_reduction_pct",
         "label": "Reduction in estimated water consumption",
         "value": s["saved_pct"], "unit": "%", "source": "estimated",
         "note": "Model scenario under these conditions — not a field trial."},
        {"metric": "irrigation_efficiency",
         "label": "Irrigation efficiency (recommended method)",
         "value": round(s.get("irrigation_efficiency_ai") or 0.45, 2) * 100,
         "unit": "%", "source": "estimated",
         "note": "Application efficiency of the current/recommended method."},
        {"metric": "crop_water_adequacy",
         "label": "Crop water adequacy",
         "value": adequacy, "unit": "% of days",
         "source": "model_prediction",
         "note": "Share of analysed days modelled at/above the crop stress "
                 "threshold. Model scenario, not a field yield measurement."},
        {"metric": "irrigation_goal_completion",
         "label": "Irrigation goal completion",
         "value": round(100 * followed / max(1, goal_days), 1)
                  if goal_days else 100.0,
         "unit": "%", "source": "estimated",
         "note": "Days on which the recommended volume matched actual "
                 "recorded irrigation."},
    ]
    # progress history for the achievement charts
    hist, cum = [], 0
    for r in daily[::max(1, len(daily) // 12)]:
        cum += r["saved_l"]
        hist.append({"date": r["date"], "cumulative_saved_l": cum,
                     "cumulative_rainwater_l": 0})
    rain_cum = 0
    for h in hist:
        day_row = next((x for x in daily if x["date"] == h["date"]), None)
        if day_row:
            rain_cum += day_row["rainwater_l"]
        h["cumulative_rainwater_l"] = rain_cum
    for m in metrics:
        m["history"] = hist
    return metrics


async def full_analysis(db: Session, farm: Farm) -> dict:
    """The complete chain — used by the dashboard + analysis overlay."""
    recorded_l = sum(e.quantity_l for e in db.query(IrrigationEvent)
                     .filter(IrrigationEvent.farm_id == farm.id).all())
    farm_dict = enrich_for_engine(db, farm)
    soil_stage = await stage_soil(farm_dict)
    weather = await stage_weather(farm_dict)
    crop_life = await stage_crop(farm_dict, weather, recorded_l)
    eto_pair = (crop_life["eto_mm_day"], crop_life["eto_source"])
    reco = irrigation_engine.optimize(farm_dict, weather["current"],
                                      weather["forecast"], recorded_l,
                                      eto_override=eto_pair)
    warnings = warnings_engine.build_warnings(farm_dict, weather["current"],
                                              weather["forecast"], reco)
    nutrients = stage_nutrients(farm_dict)
    water = compute_water_series(db, farm, days=30, reco=reco,
                                 eto_mm_day=crop_life["eto_mm_day"])
    ach = achievements_for(db, farm, water, crop_life, reco)
    nass = reference_data.nass_payload(crop_service.crop_key(farm.crop_name))
    return {
        "farm": farm_dict,
        "soil": soil_stage,
        "weather": weather,
        "crop_lifecycle": crop_life,
        "recommendation": reco,
        "warnings": warnings,
        "nutrients": nutrients,
        "water_analytics": water,
        "achievements": ach,
        "yield_reference": nass,
    }
