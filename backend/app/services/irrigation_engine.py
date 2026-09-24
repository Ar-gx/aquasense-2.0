"""Irrigation optimization engine — hybrid ML + rule-based decision pipeline.

Implements the 12-step pipeline from the specification:
 1 current moisture (measured or labelled estimate)
 2 predict moisture 24/48/72h ahead
 3 crop-specific moisture requirements (FC / WP / MAD)
 4 crop growth stage weighting
 5 forecast rainfall + probability analysis
 6 crop water deficit estimate
 7 soil type + water retention
 8 irrigation efficiency
 9 waterlogging risk check
10 decision: is irrigation required?
11 quantity (net + gross, L and L/ha)
12 timing + explanation + confidence

Optimization objective: minimise water use while keeping root-zone moisture
adequate — no irrigation merely because a schedule says so.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.services import crop_service, ml_service, soil_service, weather_service
from app.services.climate import estimate_eto

L_PER_MM_HA = 10_000.0
METHOD_EFF = {"flood": 0.45, "furrow": 0.5, "sprinkler": 0.75,
              "drip": 0.9, "center_pivot": 0.85, "manual": 0.55, "rainfed": 1.0}


def _method_eff(method: str | None) -> tuple[float, str]:
    m = (method or "flood").lower().replace(" ", "_")
    if m in METHOD_EFF:
        return METHOD_EFF[m], m
    if m in ("flood/furrow", "flood_/_furrow"):
        return 0.45, "flood"
    return 0.55, "manual"


def optimize(farm: dict, weather: dict, forecast: dict,
             recorded_irrigation_l: float = 0.0,
             eto_override: tuple[float, str] | None = None) -> dict:
    """Run the full pipeline and return the recommendation object."""
    limitations: list[str] = []
    unknowns = farm.get("unknown_fields") or []

    # --- 1. current soil moisture -------------------------------------
    moisture = farm.get("soil_moisture_pct")
    if moisture is None:
        moisture, est = soil_service.estimate_moisture_from_soil(
            farm.get("soil_type"),
            (weather.get("precip_mm_today") or 0.0))
        limitations.append("Soil moisture was not provided — an estimated value "
                           "based on soil texture and recent rain is used.")
    moisture_src = farm.get("soil_moisture_source") or (
        "user_supplied" if farm.get("soil_moisture_pct") is not None else "estimated")

    # --- 3/4. crop requirements + stage -------------------------------
    crop_key = crop_service.crop_key(farm.get("crop_name"))
    crop = crop_service.get_crop(crop_key)
    sow = farm.get("sowing_date")
    day = 0
    if sow:
        try:
            day = max(0, (datetime.utcnow().date()
                          - crop_service.parse_date(sow)).days)
        except Exception:
            limitations.append("Sowing date could not be read — using stage 1.")
    if farm.get("growth_stage"):
        for i, st in enumerate(crop["stages"]):
            if st["name"] == farm["growth_stage"]:
                day = max(day, st["start"] + 1)
    idx, stage = crop_service.current_stage(crop, day)
    root_m = stage["root_depth_m"]
    mad = stage["mad"]

    tex = soil_service.get_texture(farm.get("soil_type"))
    fc, wp, sat = tex["fc"], tex["wp"], tex["sat"]
    if farm.get("soil_type") in (None, "", "other"):
        limitations.append("Soil type unknown — loam-like reference values used.")

    stress = wp + (fc - wp) * (1 - mad)          # stress threshold (% vol)
    trigger = stress + (fc - wp) * 0.10           # conservative early trigger
    target = fc * 0.98                             # irrigate up to ~field capacity

    # --- weather / ETo -------------------------------------------------
    if eto_override is not None:
        eto, eto_method = eto_override
    else:
        eto, eto_method = estimate_eto(
            weather.get("temp_c"), weather.get("humidity_pct"),
            weather.get("wind_kmh"), None, farm.get("latitude"))
    if weather.get("source") == "simulated":
        limitations.append("Weather feed is simulated (demo mode).")

    # --- 2. prediction -------------------------------------------------
    state = {
        "soil_moisture": moisture, "temp_c": weather.get("temp_c") or 30.0,
        "humidity": weather.get("humidity_pct") or 60.0,
        "rainfall_mm": weather.get("precip_mm_today") or 0.0,
        "wind_kmh": weather.get("wind_kmh") or 10.0,
        "solar_mj": 18.0, "soil_type": farm.get("soil_type"),
        "crop": crop_key, "stage_code": idx,
        "prev_irrig_mm": 0.0, "hours_since_irrig": _hours_since_irrig(farm),
        "forecast_rain_mm": 0.0, "eto_mm_day": eto, "kc": stage["kc"],
    }
    daily = forecast.get("daily", [])
    trajectory = ml_service.predict_trajectory(state, daily, steps=7)
    pred24 = trajectory[0]["predicted_moisture_pct"] if trajectory else moisture
    pred48 = trajectory[1]["predicted_moisture_pct"] if len(trajectory) > 1 else pred24
    pred72 = trajectory[2]["predicted_moisture_pct"] if len(trajectory) > 2 else pred48
    min_pred = min(pred24, pred48, pred72)

    # --- 5. rainfall ---------------------------------------------------
    rain24, prob24 = weather_service.rain_window(forecast, 24)
    rain48, prob48 = weather_service.rain_window(forecast, 48)
    rain72, prob72 = weather_service.rain_window(forecast, 72)
    infil_factor = {"sandy": 0.9, "sandy_loam": 0.8, "loamy": 0.7,
                    "clay_loam": 0.55, "clay": 0.4}.get(
                        (farm.get("soil_type") or "other"), 0.65)
    effective_rain48 = round(rain48 * infil_factor, 1)

    # --- 6. deficit ----------------------------------------------------
    root_mm = root_m * 1000
    needed_pct = max(0.0, target - min(min_pred, moisture))
    deficit_mm = round(needed_pct / 100 * root_mm, 1)          # net root-zone
    deficit_after_rain = round(max(0.0, deficit_mm - effective_rain48), 1)

    # --- 8/9. efficiency + waterlogging --------------------------------
    eff, method_key = _method_eff(farm.get("irrigation_method"))
    area = farm.get("area_ha") or 1.0
    if area <= 0:
        area = 1.0
        limitations.append("Farm area missing — quantities shown per hectare basis.")

    waterlogging_now = moisture >= sat - 1.5
    heavy_rain_72 = rain72 >= 25 and (prob72 >= 60 or rain72 >= 40)
    waterlogging_risk = waterlogging_now or (
        heavy_rain_72 and tex["drainage"] == "slow")

    # --- 10. decision --------------------------------------------------
    required, reason_parts, skip_kind = False, [], None
    rain_sufficient = effective_rain48 >= deficit_mm * 0.8 and prob48 >= 60

    if waterlogging_now:
        skip_kind = "waterlogging"
        reason_parts.append(
            f"Soil moisture ({moisture:.1f}% vol) is at or above saturation for "
            f"{tex['label'].lower()} soil — irrigation would worsen root-zone "
            "waterlogging.")
    elif rain_sufficient:
        skip_kind = "rain"
        reason_parts.append(
            f"Forecast rain of {rain48:.1f} mm (probability {prob48}%) is "
            f"expected to supply about {effective_rain48:.1f} mm to the root "
            f"zone versus a {deficit_mm:.1f} mm deficit — irrigation is "
            "delayed to avoid waterlogging and nutrient leaching.")
    elif min_pred <= trigger:
        required = True
        reason_parts.append(
            f"Root-zone moisture is {moisture:.1f}% vol now and is projected to "
            f"fall to {min_pred:.1f}% vol within 72 h, below the "
            f"{stress:.1f}% vol stress threshold for {crop['display_name']} at "
            f"the {stage['name'].lower()} stage.")
        if rain48 < deficit_mm * 0.4:
            reason_parts.append(
                f"Only {rain48:.1f} mm of rain is forecast in the next 48 h — "
                "not enough to refill the root zone.")
    else:
        skip_kind = "adequate"
        reason_parts.append(
            f"Projected moisture ({min_pred:.1f}% vol) stays above the "
            f"{stress:.1f}% vol stress threshold over the next 72 h — the crop "
            "does not need irrigation right now.")

    if heavy_rain_72 and required:
        reason_parts.append(
            f"Caution: {rain72:.1f} mm is forecast within 72 h — apply only a "
            "reduced amount and re-check after the rain event.")

    # --- 11. quantity --------------------------------------------------
    gross_mm = 0.0
    if required:
        applied_mm = deficit_after_rain if rain48 else deficit_mm
        gross_mm = round(applied_mm / eff, 1)
    quantity_l = round(gross_mm * area * L_PER_MM_HA) if required else 0
    quantity_l_ha = round(gross_mm * L_PER_MM_HA) if required else 0
    net_l = round((gross_mm * eff) * area * L_PER_MM_HA)

    after_pct = moisture
    if required:
        after_pct = min(target, moisture + (gross_mm * eff) / root_mm * 100)

    # --- 12. timing ----------------------------------------------------
    timing = _recommend_time(farm, forecast, required, rain48, prob48)

    # --- savings vs traditional schedule -------------------------------
    savings = _event_savings(farm, quantity_l, eff, method_key, area)

    # --- confidence ----------------------------------------------------
    confidence, conf_reasons = _confidence(farm, weather, forecast, moisture_src,
                                           limitations)

    status = ("irrigation_required" if required
              else ("monitor" if skip_kind in ("adequate",) and min_pred < stress + 3
                    else "good"))
    if skip_kind in ("rain", "waterlogging"):
        status = "monitor"

    return {
        # headline (dashboard hero card)
        "irrigation_required": required,
        "status": status,
        "status_label": {"irrigation_required": "Irrigation Required",
                         "monitor": "Monitor", "good": "Good"}[status],
        "recommended_time": timing["window"] if required else None,
        "recommended_time_reason": timing["reason"],
        "quantity_l": quantity_l,
        "quantity_l_per_ha": quantity_l_ha,
        "quantity_net_l": net_l,
        "quantity_mm": gross_mm if required else 0.0,
        "reason": " ".join(reason_parts),
        "reason_parts": reason_parts,
        "expected_moisture_after_pct": round(after_pct, 1),
        "daily_goal_l": quantity_l,
        "remaining_daily_goal_l": max(
            0, quantity_l - _already_irrigated_today_l(farm)),
        # inputs echoed back with provenance
        "soil_moisture_pct": moisture,
        "soil_moisture_source": moisture_src,
        "stress_threshold_pct": round(stress, 1),
        "trigger_threshold_pct": round(trigger, 1),
        "field_capacity_pct": fc, "wilting_point_pct": wp,
        "saturation_pct": sat,
        "crop": crop["display_name"], "growth_stage": stage["name"],
        "stage_kc": stage["kc"], "root_depth_m": root_m,
        "eto_mm_day": eto, "eto_method": eto_method,
        "irrigation_efficiency": eff, "irrigation_method": method_key,
        "area_ha": area,
        "predictions": {
            "h24": pred24, "h48": pred48, "h72": pred72,
            "min_72h": min_pred,
            "model_kind": trajectory[0]["model_kind"] if trajectory else "unknown",
        },
        "rainfall": {
            "rain_24h_mm": rain24, "rain_48h_mm": rain48,
            "rain_72h_mm": rain72, "prob_24h": prob24, "prob_48h": prob48,
            "prob_72h": prob72, "effective_48h_mm": effective_rain48,
            "impact": ("Rain expected to cover the deficit — no irrigation"
                       if skip_kind == "rain"
                       else f"{rain48:.1f} mm expected in 48 h "
                            f"({effective_rain48:.1f} mm effective)"),
        },
        "waterlogging_risk": waterlogging_risk,
        "waterlogging_now": waterlogging_now,
        "savings": savings,
        "confidence": confidence,
        "confidence_reasons": conf_reasons,
        "limitations": limitations,
        "unknown_fields": unknowns,
        "suggested_method_upgrade": _method_upgrade(farm, method_key, area,
                                                    quantity_l, stage, tex),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "source": "hybrid_ml_rules",
        "label": "Hybrid ML + rule-based recommendation",
    }


def _hours_since_irrig(farm: dict) -> float:
    last = farm.get("last_irrigation_at")
    if not last:
        return 96.0
    try:
        dt = datetime.fromisoformat(str(last).replace("Z", ""))
        return max(1.0, (datetime.utcnow() - dt).total_seconds() / 3600)
    except Exception:
        return 96.0


def _already_irrigated_today_l(farm: dict) -> float:
    evts = farm.get("_events_today_l")
    return float(evts or 0)


def _recommend_time(farm: dict, forecast: dict, required: bool,
                    rain48: float, prob48: int) -> dict:
    if not required:
        return {"window": None,
                "reason": "No irrigation window recommended while soil "
                          "moisture is adequate."}
    daily = forecast.get("daily", [])
    # If a heavy rain event is likely tomorrow, better to wait for it.
    if len(daily) >= 2:
        d1 = daily[1]
        if d1.get("precip_prob_pct", 0) >= 70 and d1.get("precip_mm", 0) >= 15:
            return {
                "window": None,
                "reason": (f"Irrigation can be delayed — {d1.get('precip_mm')} mm "
                           f"rain with {d1.get('precip_prob_pct')}% probability is "
                           "forecast tomorrow. Re-check after the rain event."),
            }
    return {
        "window": "05:00 – 08:00 (early morning)",
        "reason": ("Early morning gives the lowest wind and evaporation loss "
                   "and keeps foliage dry, reducing disease risk. Avoiding "
                   "11:00–16:00 typically saves 10–15% of applied water."),
    }


def _event_savings(farm: dict, quantity_l: int, eff: float,
                   method: str, area: float) -> dict:
    last_qty = farm.get("last_irrigation_qty_l") or 0
    traditional_interval = farm.get("_traditional_interval_days") or 5
    if not last_qty:
        # conventional flood recommendation for this farm as a baseline
        last_qty = round(0.55 * 10 * area * L_PER_MM_HA / 1000) * 1000
    saved = max(0, last_qty - quantity_l) if quantity_l else last_qty * 0.0
    return {
        "traditional_event_l": round(last_qty),
        "ai_event_l": quantity_l,
        "saved_per_event_l": round(last_qty - quantity_l),
        "saved_per_event_pct": (round((last_qty - quantity_l) / last_qty * 100, 1)
                                if last_qty else 0.0),
        "traditional_interval_days": traditional_interval,
        "note": ("Comparing this recommendation with the farm's recorded "
                 "traditional irrigation quantity. Illustrative model scenario, "
                 "not a metered field measurement."),
        "source": "estimated",
    }


def _method_upgrade(farm: dict, method: str, area: float, quantity_l: int,
                    stage: dict, tex: dict) -> dict | None:
    if method in ("drip", "center_pivot") or quantity_l == 0:
        return None
    eff_now = METHOD_EFF.get(method, 0.55)
    drip_l = round(quantity_l * eff_now / 0.9)
    candidates = ["drip", "sprinkler"]
    reasons = {
        "drip": (f"Delivers water straight to the root zone at ~90% efficiency "
                 f"(vs {eff_now*100:.0f}% for {method}) — lowest risk of runoff, "
                 "waterlogging and nutrient leaching."),
        "sprinkler": ("Simulates rainfall uniformly at ~75% efficiency; suits "
                      "row crops and cereals where drip is not affordable."),
    }
    budget = (farm.get("budget_hint") or "low").lower()
    pick = "sprinkler" if budget == "low" and tex["retention"] != "high" else "drip"
    return {
        "suggested_method": pick,
        "current_method": method,
        "current_efficiency": eff_now,
        "suggested_efficiency": 0.9 if pick == "drip" else 0.75,
        "event_qty_with_suggestion_l": drip_l,
        "event_saving_l": quantity_l - drip_l,
        "why": reasons[pick],
        "budget_fit": ("Lower upfront cost than drip; good first upgrade from "
                       "flood irrigation." if pick == "sprinkler" else
                       "Higher upfront cost, fastest payback on water savings "
                       "for high-value crops."),
        "caveat": ("No single method is optimal for every farm — cost, water "
                   "quality, crop and terrain all matter."),
        "source": "rule_based",
    }


def _confidence(farm: dict, weather: dict, forecast: dict,
                moisture_src: str, limitations: list[str]) -> tuple[str, list[str]]:
    score, reasons = 3, []
    if moisture_src == "user_supplied":
        reasons.append("Soil moisture supplied by the farmer/sensor.")
    else:
        score -= 1
        reasons.append("Soil moisture is estimated, not measured (lowers confidence).")
    if weather.get("source") == "live_api":
        reasons.append("Live weather data in use.")
    elif weather.get("source") == "simulated":
        score -= 1
        reasons.append("Weather data is simulated for the demo (lowers confidence).")
    if forecast.get("source") == "live_api":
        reasons.append("Live forecast in use.")
    elif forecast.get("source") == "simulated":
        score -= 1
        reasons.append("Forecast is simulated for the demo (lowers confidence).")
    if not farm.get("area_ha"):
        score -= 1
        reasons.append("Farm area missing — volumes shown per hectare.")
    if not farm.get("soil_type") or farm.get("soil_type") == "other":
        score -= 1
        reasons.append("Soil type unknown — texture reference values used.")
    confidence = "high" if score >= 3 else ("medium" if score >= 1 else "low")
    return confidence, reasons
