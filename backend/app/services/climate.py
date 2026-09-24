"""Reference evapotranspiration (ETo).

Primary:  radiation-based Priestley-Taylor using solar radiation (NASA POWER
          or forecast) — typical Indian agro-climatic range.
Fallback: FAO-56 Hargreaves from temperature + latitude.
Both are sanity-clamped to 2.5–9.5 mm/day (physically plausible daily ETo)
and always labelled as estimates.
"""
from __future__ import annotations

import math
from datetime import date

GSC = 0.0820  # solar constant, MJ m-2 min-1
DEFAULT_ETO = 5.0
MIN_ETO, MAX_ETO = 2.5, 9.5
LAMBDA = 2.45  # latent heat of vaporisation, MJ/kg


def day_of_year(d: date | None = None) -> int:
    return (d or date.today()).timetuple().tm_yday


def extraterrestrial_radiation(lat_deg: float, j: int | None = None) -> float:
    """FAO-56 eq. 21 — Ra in MJ m-2 day-1."""
    j = j or day_of_year()
    lat = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * j / 365)
    dec = 0.409 * math.sin(2 * math.pi * j / 365 - 1.39)
    x = max(-1.0, min(1.0, -math.tan(lat) * math.tan(dec)))
    ws = math.acos(x)
    return ((24 * 60 / math.pi) * GSC * dr
            * (ws * math.sin(lat) * math.sin(dec)
               + math.cos(lat) * math.cos(dec) * math.sin(ws)))


def radiation_eto(rs_mj: float, humidity: float | None = None) -> tuple[float, str]:
    """Priestley-Taylor from incoming shortwave radiation.

    Rn approximated as 0.77*Rs - 1.5 (typical clear-to-partly-cloudy sky).
    ETo = 1.26 * Rn / lambda.
    """
    try:
        rn = max(2.0, 0.77 * rs_mj - 1.5)
        eto = 1.26 * rn / LAMBDA
        if humidity is not None and humidity > 80:
            eto *= 0.92  # humid conditions reduce thePT demand slightly
        return round(min(max(eto, MIN_ETO), MAX_ETO), 2), "radiation_priestley_taylor"
    except Exception:
        return DEFAULT_ETO, "fallback_default"


def hargreaves_eto(tmax: float, tmean: float, tmin: float,
                   lat_deg: float, j: int | None = None) -> tuple[float, str]:
    """FAO-56 Hargreaves ETo (mm/day), clamped to a plausible range."""
    try:
        ra = extraterrestrial_radiation(lat_deg, j)
        if ra <= 0:
            return DEFAULT_ETO, "fallback_default"
        trange = max(tmax - tmin, 0.5)
        eto = 0.0023 * (tmean + 17.8) * math.sqrt(trange) * ra
        return round(min(max(eto, MIN_ETO), MAX_ETO), 2), "fao56_hargreaves"
    except Exception:
        return DEFAULT_ETO, "fallback_default"


def estimate_eto(temp_c: float | None, humidity: float | None,
                 wind_kmh: float | None, solar_mj: float | None,
                 lat_deg: float | None, j: int | None = None) -> tuple[float, str]:
    """Best-effort ETo from whatever live/estimated weather is available.

    Order: solar radiation (radiation method) -> temperature (Hargreaves)
    -> documented constant.
    """
    if solar_mj is not None and solar_mj > 3:
        eto, method = radiation_eto(solar_mj, humidity)
        return eto, method
    if temp_c is not None:
        tmean = temp_c
        tmax = temp_c + 4.5
        tmin = temp_c - 5.5
        if humidity is not None and humidity > 75:
            tmax, tmin = temp_c + 3.0, temp_c - 4.0
        eto, method = hargreaves_eto(tmax, tmean, tmin, lat_deg or 20.5, j)
        adj = 1.0
        if humidity is not None:
            adj *= 1.0 + max(0.0, (60 - humidity)) * 0.003
        if wind_kmh is not None:
            adj *= 1.0 + max(0.0, (wind_kmh - 12)) * 0.004
        return round(min(max(eto * adj, MIN_ETO), MAX_ETO), 2), f"{method}_adjusted"
    return DEFAULT_ETO, "fallback_default"
