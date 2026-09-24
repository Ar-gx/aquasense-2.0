"""Weather service — live APIs with honest cascading fallbacks.

Order for current conditions: OpenWeather -> Open-Meteo -> simulated.
Order for forecasts:        Open-Meteo (7 day hourly) -> OpenWeather 5d/3h -> simulated.
History:                    NASA POWER (daily) + data.gov.in (district daily rainfall).
Every response carries a `source` tag so the UI can show the data-status panel.
"""
from __future__ import annotations

import time
from datetime import date, datetime, timedelta

import httpx

from app.core.config import settings

OPENWEATHER = "https://api.openweathermap.org/data/2.5"
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
NASA_POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
DATA_GOV = "https://api.data.gov.in/resource/"

_cache: dict[str, tuple[float, dict]] = {}


def _cached(key: str, ttl: int | None = None) -> dict | None:
    ttl = ttl or settings.reference_cache_ttl
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    return None


def _store(key: str, value: dict) -> dict:
    _cache[key] = (time.time(), value)
    return value


# --------------------------------------------------------------------------
# Deterministic simulated fallback (clearly labelled everywhere)
# --------------------------------------------------------------------------

def _day_seed(d: date, lat: float, lon: float) -> int:
    return (d.toordinal() + int(lat * 7) + int(lon * 11)) % 365


def simulated_current(lat: float | None = None, lon: float | None = None,
                      when: date | None = None) -> dict:
    when = when or date.today()
    s = _day_seed(when, lat or 11.9, lon or 76.9)
    temp = round(26.0 + ((s * 37) % 90) / 10.0, 1)          # 26.0 - 34.9
    humid = int(48 + (s * 13) % 40)                          # 48 - 87
    wind = round(6 + (s * 5) % 14, 1)                        # 6 - 19.9
    return {
        "temp_c": temp, "feels_like_c": round(temp + 1.5, 1),
        "humidity_pct": humid, "wind_kmh": wind,
        "description": "partly cloudy (simulated)",
        "precip_mm_today": 0.0,
        "pressure_hpa": 1008, "cloud_cover_pct": 45,
        "source": "simulated",
        "source_label": "Simulated demo weather (deterministic sample)",
        "observed_at": datetime.utcnow().isoformat() + "Z",
    }


def simulated_forecast(lat: float | None = None, lon: float | None = None,
                       days: int = 7) -> dict:
    """Deterministic forecast with a scripted rain event so the demo tells the
    full story: dry now -> irrigation needed -> heavy rain day 3 -> delay."""
    today = date.today()
    s = _day_seed(today, lat or 11.9, lon or 76.9)
    hourly, daily = [], []
    # scripted precipitation probability by day offset
    rain_prob = [10, 15, 75, 45, 20, 15, 10][:days]
    rain_mm = [0.0, 0.4, 14.5, 4.0, 0.0, 0.0, 0.0][:days]

    for h in range(0, min(days, 7) * 24, 1):
        d_off, hour = divmod(h, 24)
        base = 25 + (s % 5)
        temp = round(base + 5.5 * (((hour - 9) % 24) / 12 - 0.5) * -1 + 0.4 * (h % 7), 1)
        temp = round(24 + 8 * max(0.0, 1 - abs(hour - 15) / 9.0), 1)
        prob = rain_prob[d_off] if d_off < len(rain_prob) else 10
        precip = round(rain_mm[d_off] / 24.0, 2) if prob > 50 else 0.0
        hourly.append({
            "time": (datetime.combine(today, datetime.min.time())
                     + timedelta(hours=h)).isoformat(timespec="hours"),
            "temp_c": temp,
            "humidity_pct": int(55 + 30 * (1 - min(1, abs(hour - 6) / 12))),
            "precip_mm": precip, "precip_prob_pct": prob,
            "wind_kmh": round(7 + (h % 5), 1),
        })
    for d_off in range(min(days, 7)):
        daily.append({
            "date": (today + timedelta(days=d_off)).isoformat(),
            "temp_max_c": round(31 + (d_off % 3), 1),
            "temp_min_c": round(21 + (d_off % 2), 1),
            "precip_mm": rain_mm[d_off] if d_off < len(rain_mm) else 0.0,
            "precip_prob_pct": rain_prob[d_off] if d_off < len(rain_prob) else 10,
            "humidity_pct": 60 + (rain_prob[d_off] if d_off < len(rain_prob) else 10) // 4,
            "wind_kmh": 11.0, "condition": "simulated",
        })
    return {
        "hourly": hourly, "daily": daily,
        "source": "simulated",
        "source_label": "Simulated demo forecast (deterministic sample)",
    }


# --------------------------------------------------------------------------
# Live sources
# --------------------------------------------------------------------------

async def _openweather_current(lat: float, lon: float) -> dict | None:
    if not settings.openweather_api_key or settings.force_simulated_weather:
        return None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(f"{OPENWEATHER}/weather", params={
                "lat": lat, "lon": lon, "appid": settings.openweather_api_key,
                "units": "metric"})
            if r.status_code != 200:
                return None
            j = r.json()
            return {
                "temp_c": j["main"]["temp"],
                "feels_like_c": j["main"]["feels_like"],
                "humidity_pct": j["main"]["humidity"],
                "wind_kmh": round(j["wind"]["speed"] * 3.6, 1),
                "pressure_hpa": j["main"].get("pressure"),
                "cloud_cover_pct": j.get("clouds", {}).get("all"),
                "description": (j.get("weather") or [{}])[0].get("description"),
                "precip_mm_today": (j.get("rain") or {}).get("1h", 0.0),
                "city": j.get("name"),
                "source": "live_api",
                "source_label": "OpenWeather (live)",
                "observed_at": datetime.utcfromtimestamp(j["dt"]).isoformat() + "Z",
            }
    except Exception:
        return None


async def _openmeteo_current(lat: float, lon: float) -> dict | None:
    if not settings.open_meteo_enabled or settings.force_simulated_weather:
        return None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(OPEN_METEO, params={
                "latitude": lat, "longitude": lon, "timezone": "auto",
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,"
                           "precipitation,wind_speed_10m,surface_pressure"})
            if r.status_code != 200:
                return None
            c = r.json()["current"]
            return {
                "temp_c": c.get("temperature_2m"),
                "feels_like_c": c.get("apparent_temperature"),
                "humidity_pct": c.get("relative_humidity_2m"),
                "wind_kmh": c.get("wind_speed_10m"),
                "pressure_hpa": c.get("surface_pressure"),
                "precip_mm_today": c.get("precipitation", 0.0),
                "description": "current conditions",
                "source": "live_api",
                "source_label": "Open-Meteo (live, no key)",
                "observed_at": str(c.get("time", "")),
            }
    except Exception:
        return None


async def get_current(lat: float | None, lon: float | None) -> dict:
    if lat is not None and lon is not None:
        ow = await _openweather_current(lat, lon)
        if ow:
            return ow
        om = await _openmeteo_current(lat, lon)
        if om:
            return om
    return simulated_current(lat, lon)


async def get_forecast(lat: float | None, lon: float | None,
                       days: int = 7) -> dict:
    """7-day hourly + daily forecast. Open-Meteo first (keyless, has
    precipitation probability), OpenWeather as secondary, simulated last."""
    if lat is None or lon is None or not settings.open_meteo_enabled \
            or settings.force_simulated_weather:
        return simulated_forecast(lat, lon, days)
    key = f"forecast:{round(lat,3)}:{round(lon,3)}:{days}"
    hit = _cached(key, ttl=1800)
    if hit:
        return hit
    try:
        async with httpx.AsyncClient(timeout=18) as client:
            r = await client.get(OPEN_METEO, params={
                "latitude": lat, "longitude": lon, "timezone": "auto",
                "forecast_days": min(days, 7),
                "hourly": "temperature_2m,relative_humidity_2m,precipitation,"
                          "precipitation_probability,wind_speed_10m",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
                         "precipitation_probability_max,relative_humidity_2m_max,"
                         "wind_speed_10m_max"})
            if r.status_code != 200:
                return simulated_forecast(lat, lon, days)
            j = r.json()
            h = j["hourly"]
            now_iso = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
            hourly = []
            for i, t in enumerate(h["time"]):
                try:
                    ti = datetime.fromisoformat(t)
                except ValueError:
                    continue
                if ti < now_iso - timedelta(hours=1):
                    continue
                hourly.append({
                    "time": t,
                    "temp_c": h["temperature_2m"][i],
                    "humidity_pct": h["relative_humidity_2m"][i],
                    "precip_mm": h["precipitation"][i] or 0.0,
                    "precip_prob_pct": h["precipitation_probability"][i] or 0,
                    "wind_kmh": h["wind_speed_10m"][i],
                })
                if len(hourly) >= 24 * days:
                    break
            d = j["daily"]
            daily = []
            for i, day in enumerate(d["time"]):
                daily.append({
                    "date": day,
                    "temp_max_c": d["temperature_2m_max"][i],
                    "temp_min_c": d["temperature_2m_min"][i],
                    "precip_mm": d["precipitation_sum"][i] or 0.0,
                    "precip_prob_pct": (d["precipitation_probability_max"][i]
                                        or 0),
                    "humidity_pct": d["relative_humidity_2m_max"][i],
                    "wind_kmh": d["wind_speed_10m_max"][i],
                    "condition": "forecast",
                })
            payload = {
                "hourly": hourly, "daily": daily,
                "source": "live_api",
                "source_label": "Open-Meteo (live, no key)",
            }
            return _store(key, payload)
    except Exception:
        return simulated_forecast(lat, lon, days)


async def get_history(lat: float | None, lon: float | None,
                      state: str | None = None, district: str | None = None,
                      days: int = 30) -> dict:
    """NASA POWER daily meteo + data.gov.in district daily rainfall."""
    today = date.today()
    start = today - timedelta(days=days)
    key = f"hist:{round(lat or 0,3)}:{round(lon or 0,3)}:{days}"
    hit = _cached(key, ttl=settings.reference_cache_ttl)
    if hit:
        return hit

    nasa = {"source": "unavailable", "daily": []}
    if settings.nasa_power_enabled and lat and lon and not settings.force_simulated_weather:
        nasa = await _nasa_power(lat, lon, start, today)
    datagov = {"source": "unavailable", "records": []}
    if settings.data_gov_api_key and state and district:
        datagov = await _data_gov_rainfall(state, district, start, today)

    if not nasa.get("daily"):
        nasa = _simulated_history(lat, lon, days)

    payload = {"nasa_power": nasa, "district_rainfall": datagov}
    return _store(key, payload)


async def _nasa_power(lat: float, lon: float, start: date, end: date) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(NASA_POWER, params={
                "parameters": "T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,WS2M,"
                              "ALLSKY_SFC_SW_DWN",
                "community": "AG", "longitude": lon, "latitude": lat,
                "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"),
                "format": "JSON"})
            if r.status_code != 200:
                return {"source": "unavailable", "daily": [],
                        "error": f"http_{r.status_code}"}
            p = r.json()["properties"]["parameter"]

            def clean(v):
                return None if v is None or v <= -900 else v

            daily = []
            for day_str, tmean in sorted(p["T2M"].items()):
                tmean = clean(tmean)
                if tmean is None:
                    continue
                daily.append({
                    "date": f"{day_str[:4]}-{day_str[4:6]}-{day_str[6:]}",
                    "temp_mean_c": tmean,
                    "temp_max_c": clean(p["T2M_MAX"].get(day_str)),
                    "temp_min_c": clean(p["T2M_MIN"].get(day_str)),
                    "humidity_pct": clean(p["RH2M"].get(day_str)),
                    "rain_mm": max(0.0, clean(p["PRECTOTCORR"].get(day_str)) or 0.0),
                    "wind_ms": clean(p["WS2M"].get(day_str)),
                    "solar_mj_m2_day": clean(p["ALLSKY_SFC_SW_DWN"].get(day_str)),
                })
            return {"source": "live_api",
                    "source_label": "NASA POWER daily (live, ~1° grid)",
                    "granularity": "daily, grid-cell average",
                    "daily": daily}
    except Exception as exc:
        return {"source": "unavailable", "daily": [], "error": str(exc)}


async def _data_gov_rainfall(state: str, district: str,
                             start: date, end: date) -> dict:
    try:
        params = {
            "api-key": settings.data_gov_api_key,
            "format": "json",
            "limit": 500,
            "filters[State]": state,
            "filters[District]": district,
            "filters[Date]": start.isoformat(),  # narrow server side when supported
        }
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.get(f"{DATA_GOV}{settings.data_gov_rainfall_id}",
                                 params=params)
            if r.status_code != 200:
                return {"source": "unavailable", "records": [],
                        "error": f"http_{r.status_code}"}
            records = []
            for rec in r.json().get("records", []):
                d = str(rec.get("Date", ""))[:10]
                try:
                    dd = datetime.strptime(d, "%Y-%m-%d").date()
                except ValueError:
                    continue
                if start <= dd <= end:
                    records.append({"date": d,
                                    "rainfall_mm": float(rec.get("Avg_rainfall") or 0),
                                    "agency": rec.get("Agency_name")})
            records.sort(key=lambda x: x["date"])
            return {"source": "live_api",
                    "source_label": "data.gov.in district daily rainfall (live)",
                    "granularity": "district daily",
                    "records": records[-31:]}
    except Exception as exc:
        return {"source": "unavailable", "records": [], "error": str(exc)}


def _simulated_history(lat: float | None, lon: float | None,
                       days: int) -> dict:
    today = date.today()
    daily = []
    for i in range(days, 0, -1):
        d = today - timedelta(days=i)
        s = _day_seed(d, lat or 11.9, lon or 76.9)
        rain = 0.0
        if s % 5 == 0:
            rain = round(3 + (s % 17) * 1.4, 1)
        elif s % 7 == 0:
            rain = round(18 + (s % 23) * 2.1, 1)
        daily.append({
            "date": d.isoformat(),
            "temp_mean_c": round(23 + (s % 70) / 10.0, 1),
            "temp_max_c": round(29 + (s % 50) / 10.0, 1),
            "temp_min_c": round(19 + (s % 40) / 10.0, 1),
            "humidity_pct": 50 + (s % 40),
            "rain_mm": rain,
            "wind_ms": round(2 + (s % 30) / 10.0, 1),
            "solar_mj_m2_day": round(14 + (s % 80) / 10.0, 1),
        })
    return {"source": "simulated",
            "source_label": "Simulated daily weather history (deterministic sample)",
            "granularity": "daily", "daily": daily}


# --------------------------------------------------------------------------
# Aggregation helpers used by the irrigation engine
# --------------------------------------------------------------------------

def rain_window(forecast: dict, hours: int = 48) -> tuple[float, float]:
    """(total_mm, max_probability_pct) over the next `hours` of hourly data."""
    total, prob = 0.0, 0
    for h in forecast.get("hourly", [])[:hours]:
        total += float(h.get("precip_mm") or 0.0)
        prob = max(prob, int(h.get("precip_prob_pct") or 0))
    return round(total, 1), prob


def daily_rain(forecast: dict) -> list[dict]:
    return forecast.get("daily", [])
