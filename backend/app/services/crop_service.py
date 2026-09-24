"""Crop reference service — growth stages, lifecycle water analysis (Solution 1)."""
from __future__ import annotations

import json
from datetime import date, datetime
from functools import lru_cache

from app.core.config import DATA_DIR
from app.services.climate import estimate_eto

LITERS_PER_MM_PER_HA = 10_000.0  # 1 mm over 1 ha = 10,000 L


@lru_cache
def _load() -> dict:
    with open(DATA_DIR / "crops.json", encoding="utf-8") as fh:
        raw = json.load(fh)
    raw.pop("_comment", None)
    return raw


def all_crops() -> dict:
    return _load()


def get_crop(key: str | None) -> dict:
    crops = _load()
    k = (key or "other").strip().lower()
    if k in crops:
        return crops[k]
    # allow display-name match ("Wheat") or free text -> other
    for ck, cv in crops.items():
        if cv["display_name"].strip().lower() == k:
            return cv
    return crops["other"]


def crop_key(key: str | None) -> str:
    crops = _load()
    k = (key or "other").strip().lower()
    if k in crops:
        return k
    for ck, cv in crops.items():
        if cv["display_name"].strip().lower() == k:
            return ck
    return "other"


def crop_cards() -> list[dict]:
    """Visual crop cards for the onboarding wizard (spec section 5)."""
    out = []
    for key, c in _load().items():
        out.append({
            "key": key,
            "name": c["display_name"],
            "emoji": c["emoji"],
            "color": c["color"],
            "lifespan_days": c["lifespan_days"],
            "stages": [s["name"] for s in c["stages"]],
        })
    return out


def parse_date(s: str) -> date:
    return datetime.strptime(s[:10], "%Y-%m-%d").date()


def current_stage(crop: dict, day: int) -> tuple[int, dict]:
    day = max(0, day)
    for i, st in enumerate(crop["stages"]):
        if day < st["end"]:
            return i, st
    return len(crop["stages"]) - 1, crop["stages"][-1]


def lifecycle_analysis(
    crop_name: str,
    sowing_date: str,
    area_ha: float | None,
    eto_mm_day: float | None = None,
    eto_source: str = "estimated",
    recorded_irrigation_l: float = 0.0,
    as_of: date | None = None,
    lat: float | None = None,
) -> dict:
    """Solution 1 — crop analysis: full lifecycle water budget.

    Estimated water demand (model/reference based) is kept strictly separate
    from recorded irrigation events supplied by the farmer.
    """
    crop = get_crop(crop_name)
    as_of = as_of or date.today()
    sow = parse_date(sowing_date)
    day = max(0, (as_of - sow).days)
    lifespan = crop["lifespan_days"]
    day_capped = min(day, lifespan)

    if eto_mm_day is None:
        eto_mm_day, eto_method = estimate_eto(None, None, None, None, lat)
        eto_source = "estimated"

    stage_rows, cumulative_mm, remaining_mm, total_mm = [], 0.0, 0.0, 0.0
    idx, cur = current_stage(crop, day)

    for i, st in enumerate(crop["stages"]):
        days = st["end"] - st["start"]
        mm = st["kc"] * eto_mm_day * days
        total_mm += mm
        elapsed_days = max(0, min(day_capped, st["end"]) - st["start"])
        stage_mm = st["kc"] * eto_mm_day * elapsed_days
        if i < idx:
            cumulative_mm += st["kc"] * eto_mm_day * days
        elif i == idx:
            in_stage_days = max(0, day_capped - st["start"])
            cumulative_mm += st["kc"] * eto_mm_day * in_stage_days
        stage_rows.append({
            "index": i,
            "name": st["name"],
            "start_day": st["start"],
            "end_day": st["end"],
            "days": days,
            "kc": st["kc"],
            "root_depth_m": st["root_depth_m"],
            "mad": st["mad"],
            "water_mm": round(mm, 1),
            "water_l": round(mm * (area_ha or 1) * LITERS_PER_MM_PER_HA),
            "elapsed_days": min(elapsed_days, days),
            "required_to_date_mm": round(stage_mm, 1),
        })

    cumulative_mm = min(cumulative_mm, total_mm)
    remaining_mm = max(0.0, total_mm - cumulative_mm)
    area = area_ha or 1.0

    total_l = total_mm * area * LITERS_PER_MM_PER_HA
    cumulative_l = cumulative_mm * area * LITERS_PER_MM_PER_HA
    remaining_l = remaining_mm * area * LITERS_PER_MM_PER_HA

    stage_progress = 0.0
    if cur["end"] > cur["start"]:
        stage_progress = round(min(100.0, max(0.0,
            (day_capped - cur["start"]) / (cur["end"] - cur["start"]) * 100)), 1)

    days_left = max(0, lifespan - day)
    avg_per_day_l = remaining_l / days_left if days_left else 0.0

    return {
        "crop_key": crop_key(crop_name),
        "crop": crop["display_name"],
        "sowing_date": sow.isoformat(),
        "as_of": as_of.isoformat(),
        "day_of_cycle": day,
        "lifespan_days": lifespan,
        "days_until_harvest": days_left,
        "growth_stage": cur["name"],
        "stage_index": idx,
        "stage_progress_pct": stage_progress,
        "is_harvested": day >= lifespan,
        "eto_mm_day": eto_mm_day,
        "eto_source": eto_source,
        "stages": stage_rows,
        "total_water_req_mm": round(total_mm, 1),
        "total_water_req_l": round(total_l),
        "cumulative_required_mm": round(cumulative_mm, 1),
        "cumulative_required_l": round(cumulative_l),
        "remaining_water_req_mm": round(remaining_mm, 1),
        "remaining_water_req_l": round(remaining_l),
        "avg_daily_remaining_l": round(avg_per_day_l),
        # --- strict separation of estimate vs record ---
        "recorded_irrigation_l": round(recorded_irrigation_l),
        "cumulative_required_vs_recorded_l": round(cumulative_l - recorded_irrigation_l),
        "progress_pct": round(100.0 * cumulative_mm / total_mm, 1) if total_mm else 0.0,
        "source": "estimated",
        "limitation": (
            "Water requirement is a model estimate (Kc x reference ETo x stage days "
            "x farm area) using standard crop coefficients. Actual demand varies with "
            "local climate, soil and irrigation uniformity."
        ),
    }


def stage_explanations() -> list[dict]:
    """Why water demand changes across the growth cycle."""
    return [
        {"stage": "Germination", "demand": "low",
         "note": "Seedlings have shallow roots — small, frequent moisture is critical."},
        {"stage": "Vegetative", "demand": "rising",
         "note": "Leaf area expands quickly, so daily water uptake increases."},
        {"stage": "Flowering", "demand": "peak",
         "note": "Most water-sensitive stage — stress here hits yield the hardest."},
        {"stage": "Fruiting / Grain Filling", "demand": "high",
         "note": "Grain/fruit filling keeps demand high; both drought and waterlogging cause losses."},
        {"stage": "Maturity", "demand": "falling",
         "note": "Demand drops as the crop ripens — over-irrigation now risks disease and leaching."},
    ]
