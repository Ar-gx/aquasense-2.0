"""Weather & crop warnings engine (Solution 6).

Every warning carries: potential problem, why it matters, affected crop/stage,
recommended action. Uncertainty is expressed with risk language — nothing is
claimed as having actually happened unless a measurement supports it.
"""
from __future__ import annotations

from datetime import datetime

from app.services import crop_service, soil_service


def build_warnings(farm: dict, weather: dict, forecast: dict,
                   reco: dict) -> list[dict]:
    out: list[dict] = []
    crop_key = crop_service.crop_key(farm.get("crop_name"))
    crop = crop_service.get_crop(crop_key)
    day = 0
    if farm.get("sowing_date"):
        try:
            day = max(0, (datetime.utcnow().date()
                          - crop_service.parse_date(farm["sowing_date"])).days)
        except Exception:
            pass
    idx, stage = crop_service.current_stage(crop, day)
    affected = f"{crop['display_name']} — {stage['name']} stage"

    tex = soil_service.get_texture(farm.get("soil_type"))
    fc, wp, sat = tex["fc"], tex["wp"], tex["sat"]
    moisture = reco.get("soil_moisture_pct")
    stress = reco.get("stress_threshold_pct", wp + (fc - wp) * 0.5)
    daily = forecast.get("daily", [])
    rain72 = reco.get("rainfall", {}).get("rain_72h_mm", 0.0)

    def add(kind, severity, problem, why, action, evidence):
        out.append({
            "type": kind, "severity": severity,  # info | watch | warning | danger
            "potential_problem": problem,
            "why_it_matters": why,
            "affected": affected,
            "recommended_action": action,
            "evidence": evidence,
            "certainty": "risk_indicated_by_data",
            "source": "rule_based",
        })

    # --- heavy rainfall ------------------------------------------------
    heavy = [d for d in daily[:3] if (d.get("precip_mm") or 0) >= 25]
    if heavy:
        d = heavy[0]
        add("heavy_rainfall", "warning",
            f"Heavy rainfall is forecast on {d['date']} "
            f"(~{d['precip_mm']} mm, probability {d.get('precip_prob_pct', 0)}%).",
            "Heavy rain on a wet root zone can cause waterlogging, root-zone "
            "oxygen loss and washing of dissolved nutrients below the roots "
            "(nutrient leaching).",
            "Delay or reduce the next irrigation; keep drainage channels clear "
            "and re-check soil moisture after the rain event.",
            f"Forecast: {d['precip_mm']} mm on {d['date']}.")

    # --- waterlogging --------------------------------------------------
    if reco.get("waterlogging_now"):
        add("waterlogging", "danger",
            f"Current moisture ({moisture:.1f}% vol) is at/near saturation "
            f"({sat}% vol) for {tex['label'].lower()} soil.",
            "Saturated root zones suffocate roots, block nutrient uptake and "
            "increase disease risk — yield damage can start within days.",
            "Stop irrigation now; improve surface drainage; re-measure moisture "
            "before any further application.",
            "Measured/estimated moisture vs soil texture saturation reference.")
    elif reco.get("waterlogging_risk"):
        add("waterlogging", "watch",
            "Forecast rain combined with slow-draining soil creates a potential "
            "for standing water in the root zone.",
            "Waterlogging damages roots and forces nutrients below the root "
            "zone, wasting both water and fertilizer.",
            "Avoid irrigation before the rain; ensure field drainage is clear.",
            f"{rain72} mm forecast within 72 h; soil drainage: "
            f"{tex['drainage']}.")

    # --- crop water stress ---------------------------------------------
    if moisture is not None and moisture <= stress + 1.0:
        sev = "danger" if moisture <= stress else "watch"
        add("crop_water_stress", sev,
            f"Root-zone moisture ({moisture:.1f}% vol) is at or below the "
            f"{stress:.1f}% vol stress threshold for this crop/stage.",
            f"Water stress during {stage['name'].lower()} reduces yield "
            "potential; flowering is the most sensitive stage.",
            ("Apply the recommended irrigation in the early-morning window."
             if reco.get("irrigation_required") else
             "Monitor daily and re-check after the next forecast update."),
            "Soil moisture vs crop stage allowable-depletion threshold "
            "(model reference).")

    # --- extreme temperature -------------------------------------------
    hot = [d for d in daily[:3] if (d.get("temp_max_c") or 0) >= 40]
    if hot:
        add("extreme_temperature", "warning",
            f"High temperature expected ({hot[0]['temp_max_c']}°C on "
            f"{hot[0]['date']}).",
            "Heat spikes raise crop water demand quickly and can cause "
            "transient wilting even when soil moisture looks adequate.",
            "Shift irrigation to early morning; consider shade/mulch to reduce "
            "soil evaporation.",
            f"Forecast daily maximum {hot[0]['temp_max_c']}°C.")

    # --- excessive soil moisture ---------------------------------------
    if moisture is not None and fc < moisture < sat - 1.5:
        add("excessive_soil_moisture", "watch",
            f"Moisture ({moisture:.1f}% vol) is above field capacity "
            f"({fc}% vol).",
            "Water above field capacity drains past the roots, carrying "
            "dissolved nutrients with it (leaching risk).",
            "Skip the next irrigation unless rain is forecast to stop and "
            "drainage is confirmed.",
            "Moisture vs field-capacity reference for this soil texture.")

    # --- nutrient leaching risk ----------------------------------------
    sandy = (farm.get("soil_type") or "").lower() in ("sandy", "sandy_loam")
    if rain72 >= 20 and sandy:
        add("nutrient_leaching", "watch",
            f"Significant rain ({rain72} mm/72 h) on fast-draining "
            f"{tex['label'].lower()} soil creates a potential leaching risk.",
            "Dissolved nitrogen moves below the root zone with percolating "
            "water — the nutrient is lost and can reach groundwater.",
            "Delay fertilizer application until after the rain; use split "
            "nitrogen doses and organic manure to improve retention.",
            "Forecast rainfall + soil texture infiltration reference. "
            "Potential risk only — no nutrient loss is claimed.")
    elif reco.get("quantity_mm", 0) > 35 and sandy:
        add("nutrient_leaching", "watch",
            f"The recommended single application ({reco.get('quantity_mm')} mm) "
            "is large relative to this soil's infiltration capacity.",
            "Large single applications on coarse soil push water and nutrients "
            "below the root zone.",
            "Prefer drip/sprinkler with more frequent, smaller applications.",
            "Recommended quantity vs soil texture.")

    # --- no warnings ---------------------------------------------------
    if not out:
        out.append({
            "type": "no_active_warnings", "severity": "info",
            "potential_problem": "No weather or soil risk is indicated right now.",
            "why_it_matters": "Current conditions are within the crop's "
                              "estimated tolerance bands.",
            "affected": affected,
            "recommended_action": "Continue monitoring soil moisture and the "
                                  "forecast daily.",
            "evidence": "Forecast, moisture and crop-stage thresholds reviewed.",
            "certainty": "risk_indicated_by_data",
            "source": "rule_based",
        })
    return out
