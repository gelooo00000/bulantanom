"""
Current weather at Layuan Farm, from Open-Meteo.

Replaces the header's old hardcoded "28°C · Partly sunny", which read as a
live reading but never changed.

Rules:

* Server-side only. Browsers never call Open-Meteo, so a farmer's phone does
  not talk to a third party, and the only thing sent out is the farm's
  coordinates — never any account data.
* Cached. One upstream call serves every user for WEATHER_CACHE_SECONDS; a
  failure is cached briefly too, so an outage is not retried on every page.
* Honest when unavailable. Any failure returns `{"available": False}` and the
  header shows no temperature, rather than a made-up one.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_KEY = "layuan_weather_current"

# WMO weather interpretation codes, grouped into the handful of conditions a
# farmer cares about. https://open-meteo.com/en/docs (WMO Weather codes)
_CONDITIONS = {
    0: "clear",
    1: "mostly_clear",
    2: "partly_cloudy",
    3: "cloudy",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    56: "drizzle",
    57: "drizzle",
    61: "light_rain",
    63: "rain",
    65: "heavy_rain",
    66: "rain",
    67: "heavy_rain",
    80: "light_rain",
    81: "rain",
    82: "heavy_rain",
    95: "thunderstorm",
    96: "thunderstorm",
    99: "thunderstorm",
}

UNAVAILABLE = {"available": False}


def condition_for(code) -> str | None:
    """The condition key for a WMO code, or None for one we do not know."""
    if isinstance(code, bool) or not isinstance(code, int):
        return None
    return _CONDITIONS.get(code)


def _fetch() -> dict:
    response = requests.get(
        OPEN_METEO_URL,
        params={
            "latitude": settings.FARM_LATITUDE,
            "longitude": settings.FARM_LONGITUDE,
            "current": "temperature_2m,weather_code,is_day",
            "timezone": "Asia/Manila",
        },
        timeout=settings.WEATHER_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    current = response.json().get("current") or {}

    temperature = current.get("temperature_2m")
    condition = condition_for(current.get("weather_code"))
    if isinstance(temperature, bool) or not isinstance(temperature, (int, float)):
        raise ValueError("no temperature in the response")
    if condition is None:
        raise ValueError(f"unknown weather code {current.get('weather_code')!r}")

    return {
        "available": True,
        "temperature_c": round(float(temperature)),
        "condition": condition,
        "is_day": current.get("is_day") == 1,
        "observed_at": current.get("time") or "",
    }


def current_weather() -> dict:
    """Current weather at the farm, cached; `{"available": False}` on failure."""
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    try:
        weather = _fetch()
        ttl = settings.WEATHER_CACHE_SECONDS
    except Exception as exc:
        logger.warning("Weather unavailable: %s: %s", type(exc).__name__, exc)
        weather = UNAVAILABLE
        ttl = settings.WEATHER_FAILURE_CACHE_SECONDS

    cache.set(CACHE_KEY, weather, ttl)
    return weather


RECENT_CACHE_KEY = "layuan_weather_recent"
RECENT_DAYS = 7
# Below this a day's rain is a passing shower, not a rainy day.
RAINY_DAY_MM = 1.0


def _number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _fetch_recent() -> dict:
    response = requests.get(
        OPEN_METEO_URL,
        params={
            "latitude": settings.FARM_LATITUDE,
            "longitude": settings.FARM_LONGITUDE,
            "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
            "past_days": RECENT_DAYS,
            "forecast_days": 1,
            "timezone": "Asia/Manila",
        },
        timeout=settings.WEATHER_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    daily = response.json().get("daily") or {}

    # The last RECENT_DAYS entries end with today (so far).
    dates = (daily.get("time") or [])[-RECENT_DAYS:]
    rain = (daily.get("precipitation_sum") or [])[-RECENT_DAYS:]
    highs = (daily.get("temperature_2m_max") or [])[-RECENT_DAYS:]
    lows = (daily.get("temperature_2m_min") or [])[-RECENT_DAYS:]
    if not dates or not all(
        len(values) == len(dates) and all(_number(v) for v in values)
        for values in (rain, highs, lows)
    ):
        raise ValueError("incomplete daily weather in the response")

    return {
        "available": True,
        "days": len(dates),
        "from": dates[0],
        "to": dates[-1],
        "rain_total_mm": round(sum(rain), 1),
        "rainy_days": sum(1 for mm in rain if mm >= RAINY_DAY_MM),
        "wettest_day_mm": round(max(rain), 1),
        "temperature_max_c": round(max(highs)),
        "temperature_min_c": round(min(lows)),
    }


def recent_weather() -> dict:
    """
    The last week's rain and temperature at the farm, cached.

    Attached to every weekly assessment, so the risk evaluation knows the
    weather the farmer no longer has to describe. `{"available": False}` on
    failure: an assessment is never held up by the weather.
    """
    cached = cache.get(RECENT_CACHE_KEY)
    if cached is not None:
        return cached

    try:
        weather = _fetch_recent()
        ttl = settings.WEATHER_CACHE_SECONDS
    except Exception as exc:
        logger.warning("Recent weather unavailable: %s: %s", type(exc).__name__, exc)
        weather = UNAVAILABLE
        ttl = settings.WEATHER_FAILURE_CACHE_SECONDS

    cache.set(RECENT_CACHE_KEY, weather, ttl)
    return weather
