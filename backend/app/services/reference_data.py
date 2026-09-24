"""Reference datasets — FAO AQUASTAT & USDA NASS extracts + live USDA NASS.

Both bundled extracts are HISTORICAL datasets compiled from the publishing
organisation's public statistics. They are clearly labelled as such in the UI
and are never presented as measurements of the farmer's field.
"""
from __future__ import annotations

import json
from functools import lru_cache

import httpx

from app.core.config import DATA_DIR, settings

NASS_URL = "https://quickstats.nass.usda.gov/api/api_GET/"


@lru_cache
def aquastat() -> dict:
    with open(DATA_DIR / "aquastat_reference.json", encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache
def nass_reference() -> dict:
    with open(DATA_DIR / "nass_reference.json", encoding="utf-8") as fh:
        return json.load(fh)


def aquastat_payload() -> dict:
    raw = aquastat()
    return {
        "indicators": raw["indicators"],
        "state_context": raw.get("state_context", {}),
        "country": raw["country"],
        "source": "historical_dataset",
        "source_label": raw["source_year"],
        "granularity": raw["granularity"],
        "live": False,
        "note": "Published national/sub-national statistics for context only. "
                "Not farm-level and not a measurement of this farm.",
    }


def nass_payload(crop_key: str) -> dict:
    raw = nass_reference()
    yield_t_ha = raw["yields_t_ha"].get(crop_key)
    return {
        "benchmark_yield_t_ha": yield_t_ha,
        "source": "historical_dataset",
        "source_label": raw["source_year"],
        "granularity": raw["granularity"],
        "live": False,
        "note": raw["notes"],
    }


async def fetch_nass_live(crop: str, year: int | None = None) -> dict:
    """Optional live USDA NASS Quick Stats call (needs free API key)."""
    if not settings.usda_nass_api_key:
        return {"live": False, "reason": "no_api_key",
                **nass_payload(crop)}
    try:
        params = {
            "key": settings.usda_nass_api_key,
            "commodity_desc": crop.upper(),
            "format": "JSON",
            "source_desc": "SURVEY",
        }
        if year:
            params["year"] = str(year)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(NASS_URL, params=params)
            if r.status_code != 200:
                return {"live": False, "reason": f"http_{r.status_code}",
                        **nass_payload(crop)}
            records = r.json().get("data", [])[:10]
            return {"live": True, "source": "live_api", "records": records,
                    "source_label": "USDA NASS Quick Stats (live)"}
    except Exception as exc:
        return {"live": False, "reason": str(exc), **nass_payload(crop)}
