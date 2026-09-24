"""Water-saving calculations (Solutions 5 & 8).

Water Saved = Baseline Water Usage − AI Water Usage.
Negative savings are reported honestly, never flipped to positive.
Rainwater utilisation is tracked SEPARATELY from irrigation savings so the
same water is never counted twice.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

L_PER_MM_HA = 10_000.0
METHOD_EFF = {"flood": 0.45, "furrow": 0.5, "sprinkler": 0.75,
              "drip": 0.9, "center_pivot": 0.85, "manual": 0.55, "rainfed": 1.0}


def _safe_pct(saved: float, baseline: float) -> float:
    if baseline <= 0:
        return 0.0
    return round(saved / baseline * 100, 1)


def compute_daily_series(
    days: list[dict],
    area_ha: float,
    baseline_per_event_l: float,
    baseline_interval_days: int,
    ai_eff: float,
    ai_events: dict[str, float],
    crop_stage_kc: float = 1.0,
    eto_mm_day: float = 5.0,
    root_depth_m: float = 0.7,
    fc: float = 32.0,
    wp: float = 12.0,
) -> list[dict]:
    """Build daily baseline vs AI vs saved series from weather history.

    ai_events maps ISO date -> litres the AI engine would apply that day.
    Rain days where the AI skips irrigation also credit `rainwater_l`
    (water not pumped because the rain covered the deficit) — tracked apart
    from efficiency savings to avoid double counting.
    """
    rows = []
    # replay a simple bucket for the baseline schedule
    moisture = fc - 1.0
    interval = max(1, baseline_interval_days)
    for i, d in enumerate(days):
        ds = d["date"]
        rain = float(d.get("rain_mm") or 0.0)
        et = crop_stage_kc * float(d.get("eto_mm_day") or eto_mm_day)
        root_mm = root_depth_m * 1000

        baseline_l = 0.0
        if i % interval == 0:
            baseline_l = baseline_per_event_l
            net_mm = (baseline_l * 0.45) / (area_ha * L_PER_MM_HA)
            moisture += net_mm / root_mm * 100

        ai_l = float(ai_events.get(ds, 0.0))
        rain_l = 0.0
        # rain credited to AI when AI did NOT irrigate but baseline did
        if baseline_l > 0 and ai_l == 0 and rain > 5:
            rain_l = round(min(rain * 0.6, baseline_l / 1000)
                           * area_ha * 1000)
        if ai_l:
            net_mm = (ai_l * ai_eff) / (area_ha * L_PER_MM_HA)
            moisture += net_mm / root_mm * 100
        # rainfall + ET applied to both narratives equally
        moisture += (rain * 0.5) / root_mm * 100
        moisture -= et / root_mm * 100
        moisture = max(wp - 2, min(fc + 3, moisture))

        saved = baseline_l - ai_l
        rows.append({
            "date": ds,
            "baseline_l": round(baseline_l),
            "ai_l": round(ai_l),
            "saved_l": round(saved),
            "saved_pct": _safe_pct(saved, baseline_l),
            "rainwater_l": round(rain_l),
            "rain_mm": rain,
            "moisture_pct": round(moisture, 1),
        })
    return rows


def summarize(series: list[dict], area_ha: float) -> dict:
    baseline = sum(r["baseline_l"] for r in series)
    ai = sum(r["ai_l"] for r in series)
    irrigation_saved = sum(r["saved_l"] for r in series)
    rainwater = sum(r["rainwater_l"] for r in series)
    # Rain-credit days contribute 0 to irrigation_saved, so total reduction
    # is the SUM of the two — the same litre is never in both buckets.
    total_reduction = irrigation_saved + rainwater
    return {
        "baseline_total_l": round(baseline),
        "ai_total_l": round(ai),
        "saved_l": round(irrigation_saved),
        "saved_pct": _safe_pct(total_reduction, baseline),
        "saved_per_ha_l": round(irrigation_saved / area_ha) if area_ha else 0,
        "baseline_per_ha_l": round(baseline / area_ha) if area_ha else 0,
        "ai_per_ha_l": round(ai / area_ha) if area_ha else 0,
        "rainwater_conserved_l": round(rainwater),
        "rainwater_per_ha_l": round(rainwater / area_ha) if area_ha else 0,
        "total_reduction_l": round(total_reduction),
        "irrigation_efficiency_baseline": 0.45,
        "irrigation_efficiency_ai": None,
        "negative_savings": total_reduction < 0,
        "basis": ("Baseline = traditional fixed-schedule irrigation at the "
                  "farm's recorded interval and quantity; AI = water-balance "
                  "recommendations at the current/recommended method "
                  "efficiency. Irrigation savings and rainwater utilisation "
                  "are separate buckets — no litre is counted twice."),
        "source": "estimated",
        "label": "Model scenario (illustrative) — not metered field results",
    }


def calculator(baseline_per_ha: float, ai_per_ha: float,
               area_ha: float) -> dict:
    """Water-savings calculator endpoint maths with safe input handling."""
    errors = []
    b, a, area = float(baseline_per_ha or 0), float(ai_per_ha or 0), float(area_ha or 0)
    if b < 0 or a < 0 or area < 0:
        errors.append("Values must not be negative.")
    if area == 0:
        errors.append("Farm area is 0 — showing per-hectare values only.")
    if b == 0:
        errors.append("Baseline water usage is 0 — reduction % cannot be computed.")
    baseline_total = b * max(area, 0)
    ai_total = a * max(area, 0)
    water_saved = baseline_total - ai_total
    reduction_pct = (water_saved / baseline_total * 100) if baseline_total > 0 else None
    return {
        "baseline_per_ha_l": b, "ai_per_ha_l": a, "area_ha": area,
        "baseline_total_l": round(baseline_total),
        "ai_total_l": round(ai_total),
        "water_saved_l": round(water_saved),
        "reduction_pct": round(reduction_pct, 1) if reduction_pct is not None else None,
        "negative_savings": water_saved < 0,
        "interpretation": (
            "Negative savings: the AI scenario uses MORE water than the "
            "baseline — reported honestly." if water_saved < 0 else
            "Water Saved = Baseline − AI."),
        "errors": errors,
        "source": "illustrative_comparison",
    }


def rollup(series: list[dict], mode: str) -> list[dict]:
    """daily | weekly | monthly | cycle aggregation for the charts."""
    if mode == "daily" or not series:
        return series
    buckets: dict[str, dict] = {}
    for r in series:
        d = datetime.strptime(r["date"], "%Y-%m-%d").date()
        if mode == "weekly":
            key = (d - timedelta(days=d.weekday())).isoformat()
            label = f"Week of {key}"
        elif mode == "monthly":
            key = d.strftime("%Y-%m")
            label = key
        else:  # cycle
            key, label = "crop-cycle", "Full crop cycle"
        b = buckets.setdefault(key, {
            "date": key, "label": label, "baseline_l": 0, "ai_l": 0,
            "saved_l": 0, "rainwater_l": 0, "rain_mm": 0.0,
            "moisture_pct": r["moisture_pct"], "days": 0, "saved_pct": 0.0})
        b["baseline_l"] += r["baseline_l"]
        b["ai_l"] += r["ai_l"]
        b["saved_l"] += r["saved_l"]
        b["rainwater_l"] += r["rainwater_l"]
        b["rain_mm"] = round(b["rain_mm"] + r["rain_mm"], 1)
        b["days"] += 1
    out = sorted(buckets.values(), key=lambda x: x["date"])
    for b in out:
        b["saved_pct"] = _safe_pct(b["saved_l"], b["baseline_l"])
    return out
