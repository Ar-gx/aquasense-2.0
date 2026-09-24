"""Geocoding service — browser location, search, reverse lookup.

Primary: Open-Meteo geocoding (no key). Secondary: Nominatim / OpenStreetMap
for reverse geocoding browser coordinates into taluk/district/state.
Nothing here ever claims a more precise location than the source provides.
"""
from __future__ import annotations

import httpx

from app.core.config import settings

NOMINATIM = "https://nominatim.openstreetmap.org"
GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"
UA = {"User-Agent": "AquaSenseAI/1.0 (hackathon demo; contact: local)"}


async def search_places(query: str, limit: int = 6) -> dict:
    """Forward geocode for the location-search box."""
    if not settings.geocoder_enabled or not query.strip():
        return {"results": [], "source": "disabled"}
    results: list[dict] = []
    source = "live_api"
    try:
        async with httpx.AsyncClient(timeout=12, headers=UA) as client:
            r = await client.get(GEOCODE, params={
                "name": query, "count": limit, "language": "en", "format": "json"})
            if r.status_code == 200:
                for item in r.json().get("results", []):
                    results.append({
                        "name": item.get("name"),
                        "latitude": item.get("latitude"),
                        "longitude": item.get("longitude"),
                        "state": item.get("admin1"),
                        "district": item.get("admin2"),
                        "taluk": item.get("admin3") or item.get("admin2"),
                        "country": item.get("country"),
                        "population": item.get("population"),
                        "precision": "place-level (approximate)",
                    })
        if not results:  # Nominatim fallback
            async with httpx.AsyncClient(timeout=12, headers=UA) as client:
                r = await client.get(f"{NOMINATIM}/search", params={
                    "q": query, "format": "jsonv2", "limit": limit,
                    "countrycodes": "in", "accept-language": "en"})
                if r.status_code == 200:
                    for item in r.json():
                        a = item.get("address", {})
                        results.append({
                            "name": item.get("display_name", query),
                            "latitude": float(item["lat"]),
                            "longitude": float(item["lon"]),
                            "state": a.get("state"),
                            "district": a.get("state_district") or a.get("county"),
                            "taluk": a.get("city") or a.get("town") or a.get("village"),
                            "country": a.get("country"),
                            "population": None,
                            "precision": "approximate",
                        })
            source = "live_api"
    except Exception as exc:
        return {"results": [], "source": "error", "error": str(exc)}
    return {"results": results, "source": source}


async def reverse_lookup(lat: float, lon: float) -> dict:
    """Reverse geocode browser coordinates -> taluk / district / state."""
    empty = {"taluk": None, "district": None, "state": None,
             "source": "unavailable", "precision": "coordinates only"}
    if not settings.geocoder_enabled:
        return empty
    try:
        async with httpx.AsyncClient(timeout=12, headers=UA) as client:
            r = await client.get(f"{NOMINATIM}/reverse", params={
                "lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10,
                "accept-language": "en"})
            if r.status_code != 200:
                return empty
            a = r.json().get("address", {})
            state = a.get("state")
            district = (a.get("state_district") or a.get("county")
                        or a.get("city_district") or a.get("district"))
            taluk = (a.get("city") or a.get("town") or a.get("village")
                     or a.get("municipality") or a.get("suburb"))
            return {
                "taluk": taluk, "district": district, "state": state,
                "display_name": r.json().get("display_name"),
                "source": "live_api",
                "precision": "reverse-geocoded (approximate administrative area)",
            }
    except Exception as exc:
        return {**empty, "error": str(exc)}
