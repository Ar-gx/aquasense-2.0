"""Nutrient replenishment engine (Solution 3).

Model-ASSISTED estimates only. When no soil test is supplied we never claim
measured nutrient values — everything is labelled as an estimate, with an
explanation of the factors behind every compatibility score.
"""
from __future__ import annotations

from datetime import datetime

from app.services import crop_service

# Legume / green-manure options: nitrogen fixation potential kg N/ha/season,
# soil preferences, water needs. Reference ranges from standard agronomy data.
LEGUMES = [
    {"key": "greengram", "name": "Green gram (moong)", "n_fixed_kg_ha": 65,
     "soils": ["loamy", "sandy_loam", "clay_loam"], "duration_days": 60,
     "note": "Short-duration legume; quick rotation crop that fixes nitrogen."},
    {"key": "blackgram", "name": "Black gram (urad)", "n_fixed_kg_ha": 75,
     "soils": ["loamy", "clay_loam", "clay"], "duration_days": 90,
     "note": "Good for moderate-to-heavy soils; rebuilds soil nitrogen."},
    {"key": "chickpea", "name": "Chickpea (gram)", "n_fixed_kg_ha": 55,
     "soils": ["sandy_loam", "loamy"], "duration_days": 100,
     "note": "Rabi legume; thrives on residual moisture, low water need."},
    {"key": "groundnut", "name": "Groundnut", "n_fixed_kg_ha": 70,
     "soils": ["sandy_loam", "loamy"], "duration_days": 110,
     "note": "Legume + cash crop; improves soil structure while fixing N."},
    {"key": "soybean", "name": "Soybean", "n_fixed_kg_ha": 110,
     "soils": ["loamy", "clay_loam"], "duration_days": 100,
     "note": "High nitrogen fixation; excellent after cereals."},
    {"key": "cowpea", "name": "Cowpea (lobia)", "n_fixed_kg_ha": 80,
     "soils": ["sandy", "sandy_loam", "loamy"], "duration_days": 75,
     "note": "Drought-tolerant legume for lighter soils."},
    {"key": "pigeonpea", "name": "Pigeon pea (tur/arhar)", "n_fixed_kg_ha": 90,
     "soils": ["loamy", "clay_loam", "clay"], "duration_days": 160,
     "note": "Long-duration legume; deep roots break plough pan."},
    {"key": "sesbania", "name": "Sesbania (dhaincha, green manure)",
     "n_fixed_kg_ha": 120, "soils": ["clay", "clay_loam", "loamy"],
     "duration_days": 45,
     "note": "Green manure — incorporate before flowering for max benefit."},
    {"key": "sunhemp", "name": "Sunhemp (green manure)", "n_fixed_kg_ha": 95,
     "soils": ["sandy_loam", "loamy", "clay_loam"], "duration_days": 50,
     "note": "Fast green manure; also suppresses nematodes."},
    {"key": "clover", "name": "Egyptian clover (berseem)", "n_fixed_kg_ha": 100,
     "soils": ["loamy", "clay_loam", "sandy_loam"], "duration_days": 60,
     "note": "Multi-cut fodder legume; strong nitrogen contribution."},
]

MANURES = [
    {"key": "fym", "name": "Farmyard manure", "rate": "10–15 t/ha",
     "supplies": ["n", "p", "k", "organic_carbon"],
     "note": "Improves structure, water holding and nutrient retention."},
    {"key": "compost", "name": "Vermicompost / farm compost", "rate": "5–8 t/ha",
     "supplies": ["n", "p", "organic_carbon"],
     "note": "Nutrient-richer than raw FYM; better for vegetable crops."},
    {"key": "green_manure", "name": "Green manure incorporation", "rate": "1 crop/season",
     "supplies": ["n", "organic_carbon"],
     "note": "Adds fresh organic matter and biologically fixed nitrogen."},
    {"key": "rhizobium", "name": "Rhizobium biofertilizer seed/root inoculant",
     "rate": "per label", "supplies": ["n"],
     "note": "Boosts legume nitrogen fixation; low cost."},
    {"key": "psb", "name": "Phosphate-solubilizing biofertilizer (PSB)",
     "rate": "per label", "supplies": ["p"],
     "note": "Makes soil phosphate available to the crop."},
    {"key": "mop", "name": "Muriate of potash (0:0:60)", "rate": "soil-test based",
     "supplies": ["k"],
     "note": "Only where a soil test or clear deficiency signs indicate K need."},
    {"key": "dap_urea_split", "name": "Balanced NPK applied in splits",
     "rate": "soil-test based", "supplies": ["n", "p"],
     "note": "Split doses reduce leaching loss compared to a single dose."},
]


def analyze(farm: dict, soil_nutrients_supplied: bool = False) -> dict:
    crop_key = crop_service.crop_key(farm.get("crop_name"))
    crop = crop_service.get_crop(crop_key)
    demand = crop.get("nutrient_demand_kg_ha") or {"n": 90, "p": 40, "k": 60}

    sow = farm.get("sowing_date")
    day = 0
    if sow:
        try:
            day = max(0, (datetime.utcnow().date()
                          - crop_service.parse_date(sow)).days)
        except Exception:
            pass
    _, stage = crop_service.current_stage(crop, day)
    progress = min(1.0, day / max(1, crop["lifespan_days"]))

    # Uptake curve: crops take up most nutrients mid-cycle (sigmoid-ish).
    uptake = 0.15 + 0.85 * min(1.0, progress * 1.25)
    est = {k: round(v * uptake, 1) for k, v in demand.items()}

    # Previous-crop credit (legume predecessor fixes ~40-60 kg N/ha)
    prev = (farm.get("previous_crop") or "").lower()
    legume_prev = any(w in prev for w in
                      ["pulse", "gram", "bean", "soy", "groundnut", "moong",
                       "urad", "lentil", "pea", "legume"])
    n_credit = 45 if legume_prev else 0
    if n_credit:
        est["n"] = max(0.0, round(est["n"] - n_credit, 1))

    has_test = bool(farm.get("soil_nutrients")) and soil_nutrients_supplied
    if has_test:
        basis = "user_supplied_soil_test"
        basis_note = "Based on soil nutrient values supplied by the farmer."
    else:
        basis = "estimated_no_soil_test"
        basis_note = ("No soil test provided — depletion is a MODEL ESTIMATE "
                      "from crop nutrient demand and growth progress. It is "
                      "not a measured nutrient value.")

    soil_type = (farm.get("soil_type") or "other").lower().replace(" ", "_")

    # --- legume matching with explained compatibility score -------------
    scored = []
    for lg in LEGUMES:
        soil_fit = 100 if soil_type in lg["soils"] else (
            60 if soil_type in ("other", "") else 35)
        # nutrient alignment: the more N the current crop removed, the better
        n_need = min(100.0, (est.get("n", 0) / 120.0) * 100)
        n_fit = 40 + 0.6 * n_need
        # rotation benefit: cereal after cereal is worse
        rotation_benefit = 90 if crop_key in ("rice", "wheat", "maize",
                                              "sugarcane", "cotton") else 65
        score = round(0.4 * soil_fit + 0.4 * n_fit + 0.2 * rotation_benefit, 1)
        scored.append({**lg, "compatibility_pct": min(98.0, score),
                       "factors": {
                           "soil_texture_fit_pct": soil_fit,
                           "nutrient_alignment_pct": round(n_fit, 1),
                           "rotation_benefit_pct": rotation_benefit,
                           "n_fixed_kg_ha": lg["n_fixed_kg_ha"],
                       }})
    scored.sort(key=lambda x: x["compatibility_pct"], reverse=True)
    top = scored[:4]

    # --- manures matched to estimated deficit ---------------------------
    manures = []
    for m in MANURES:
        relevant = False
        if "n" in m["supplies"] and est.get("n", 0) >= 30:
            relevant = True
        if "p" in m["supplies"] and est.get("p", 0) >= 15:
            relevant = True
        if "k" in m["supplies"] and (crop_key in ("potato", "tomato",
                                                  "sugarcane", "onion")
                                     or est.get("k", 0) >= 60):
            relevant = True
        if "organic_carbon" in m["supplies"]:
            relevant = True
        if relevant:
            manures.append({**m, "why": _manure_why(m, est, crop_key)})

    # --- warning: nutrient-intensive crop on unknown/low soil -----------
    warning = None
    intensive = crop_key in ("sugarcane", "rice", "maize", "cotton")
    if intensive and not has_test:
        warning = (
            f"Caution: {crop['display_name']} is a nutrient-intensive crop and "
            "no soil test was provided. Estimated depletion is high for the "
            "current conditions — consider a soil test before the next season "
            "and prioritise organic matter + split fertilizer doses.")
    elif intensive and legume_prev is False and crop_key == "rice":
        warning = ("Rice followed by continuous cereals tends to exhaust "
                   "nitrogen — include a legume rotation or green manure.")

    explanation = {
        "how_score_is_computed": (
            "Compatibility = 0.4 × soil-texture fit + 0.4 × nutrient alignment "
            "(estimated N removed by the current crop) + 0.2 × rotation "
            "benefit. Scores are relative suitability indicators, not yield "
            "guarantees."),
        "factors_used": [
            f"Crop: {crop['display_name']} ({day} days, {stage['name']} stage)",
            f"Estimated nutrient uptake so far: N {est['n']} / P {est['p']} / "
            f"K {est['k']} kg/ha",
            f"Previous crop: {farm.get('previous_crop') or 'not provided'}",
            f"Soil type: {farm.get('soil_type') or 'unknown'}",
            f"N credit from previous legume: {n_credit} kg/ha" if n_credit
            else "No previous-legume nitrogen credit applied",
        ],
        "basis": basis,
        "basis_note": basis_note,
        "data_not_used": (["No laboratory soil test was supplied."
                           if not has_test else None]),
    }

    return {
        "crop": crop["display_name"],
        "growth_stage": stage["name"],
        "estimated_depletion": {
            **est,
            "basis": basis,
            "unit": "kg/ha (estimated cumulative uptake so far)",
            "previous_legume_credit_n_kg_ha": n_credit,
        },
        "legume_recommendations": top,
        "manure_recommendations": manures[:5],
        "compatibility_pct": top[0]["compatibility_pct"] if top else None,
        "warning": warning,
        "explanation": explanation,
        "source": "estimated",
        "label": "Model-assisted estimate — not a laboratory measurement",
    }


def _manure_why(m: dict, est: dict, crop_key: str) -> str:
    bits = []
    if "n" in m["supplies"]:
        bits.append(f"supports estimated N demand ({est.get('n')} kg/ha)")
    if "p" in m["supplies"]:
        bits.append("supplies phosphorus for root/flower development")
    if "k" in m["supplies"]:
        bits.append("supports grain/fill and disease resistance")
    if "organic_carbon" in m["supplies"]:
        bits.append("improves water holding — reduces irrigation frequency")
    return f"{m['name']} — {', '.join(bits)}."
