"""Soil reference service — texture parameters, moisture estimation, SoilGrids."""
from __future__ import annotations

import json
from functools import lru_cache

import httpx

from app.core.config import settings

SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"


@lru_cache
def _textures() -> dict:
    with open(__import__("app.core.config", fromlist=["DATA_DIR"]).DATA_DIR
              / "soil_textures.json", encoding="utf-8") as fh:
        raw = json.load(fh)
    raw.pop("_comment", None)
    return raw


def all_textures() -> dict:
    return _textures()


def get_texture(soil_type: str | None) -> dict:
    tex = _textures()
    k = (soil_type or "other").strip().lower().replace(" ", "_")
    if k in tex:
        return tex[k]
    for tk, tv in tex.items():
        if tv["label"].lower() == (soil_type or "").strip().lower():
            return tv
    return tex["other"]


def texture_cards() -> list[dict]:
    return [{"key": k, **v} for k, v in _textures().items() if k != "other"]


def estimate_moisture_from_soil(soil_type: str | None, recent_rain_mm: float = 0.0,
                                days_since_rain: int = 3) -> tuple[float, str]:
    """Labelled ESTIMATE used when the farmer has no sensor ('I don't know')."""
    tex = get_texture(soil_type)
    fc, wp, sat = tex["fc"], tex["wp"], tex["sat"]
    # Heuristic: between WP and FC, scaled by recent rain & drainage.
    base = wp + (fc - wp) * 0.55
    if recent_rain_mm > 10:
        base = min(fc + (sat - fc) * 0.4, base + recent_rain_mm * 0.35)
    elif days_since_rain >= 5:
        base = max(wp + 2, base - 3)
    return round(min(max(base, wp), sat), 1), "estimated"


def moisture_status(moisture: float | None, soil_type: str | None,
                    mad: float = 0.5) -> dict:
    """Classify a moisture reading against WP/FC/stress/saturation bands."""
    tex = get_texture(soil_type)
    fc, wp, sat = tex["fc"], tex["wp"], tex["sat"]
    if moisture is None:
        return {"fc": fc, "wp": wp, "sat": sat, "band": "unknown",
                "stress_threshold": round(wp + (fc - wp) * (1 - mad), 1)}
    stress = wp + (fc - wp) * (1 - mad)
    if moisture >= sat - 1.5:
        band = "waterlogging_risk"
    elif moisture >= fc + 1:
        band = "above_field_capacity"
    elif moisture >= stress:
        band = "healthy"
    elif moisture >= stress - 2:
        band = "monitor"
    else:
        band = "crop_stress"
    return {
        "moisture_pct": moisture,
        "field_capacity_pct": fc,
        "wilting_point_pct": wp,
        "saturation_pct": sat,
        "stress_threshold_pct": round(stress, 1),
        "band": band,
        "available_water_pct": round(max(0.0, moisture - wp), 1),
        "source": "estimated" if moisture is None else "user_supplied",
        "limitation": "Field capacity/wilting point are soil-texture reference values, "
                      "not measured at this farm.",
    }


async def fetch_soilgrids(lat: float, lon: float) -> dict:
    """Best-effort SoilGrids lookup (public, no key). Never raises."""
    out = {"source": "live_api", "available": False}
    if not settings.geocoder_enabled:
        return out
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(SOILGRIDS_URL, params={
                "lat": lat, "lon": lon,
                "property": "clay","property": "sand", "property": "silt",
                "depth": "0-5cm", "value": "mean",
            })
            if r.status_code != 200:
                return out
            props = r.json().get("properties", [])
            vals = {}
            for p in props:
                depth = (p.get("depths") or [{}])[0]
                v = depth.get("value")
                if v is not None and v > -9000:
                    vals[p.get("name")] = round(float(v) / 10.0, 1)  # g/kg -> %
            if vals:
                out.update({"available": True, "texture_percent": vals,
                            "granularity": "point sample (0-5 cm)"})
                sand = vals.get("sand", 50.0)
                clay = vals.get("clay", 20.0)
                if clay >= 35:
                    inferred = "clay"
                elif clay >= 27:
                    inferred = "clay_loam"
                elif sand >= 65:
                    inferred = "sandy"
                elif sand >= 52:
                    inferred = "sandy_loam"
                else:
                    inferred = "loamy"
                out["inferred_soil_type"] = inferred
    except Exception as exc:  # network issues must never break the app
        out["error"] = str(exc)
    return out
