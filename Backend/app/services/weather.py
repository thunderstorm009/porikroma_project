import asyncio
from datetime import date, datetime, timedelta
import logging
import time
from typing import Any, Dict, List, Optional
import httpx
from app.config import get_settings

logger = logging.getLogger("porikroma.weather")

CACHE_TTL_SECONDS = 1800  # 30 minutes


class WeatherCache:
    """Thread-safe in-memory cache with 30-minute expiration for weather queries."""

    def __init__(self, ttl: int = CACHE_TTL_SECONDS):
        self.ttl = ttl
        self._cache: Dict[str, tuple[float, dict]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[dict]:
        now = time.monotonic()
        async with self._lock:
            if key in self._cache:
                timestamp, data = self._cache[key]
                if now - timestamp < self.ttl:
                    cached_copy = dict(data)
                    cached_copy["cached"] = True
                    return cached_copy
                else:
                    del self._cache[key]
        return None

    async def set(self, key: str, data: dict):
        now = time.monotonic()
        async with self._lock:
            self._cache[key] = (now, data)

    async def clear(self):
        async with self._lock:
            self._cache.clear()


weather_cache = WeatherCache()

# Canonical Bangladesh destination coordinates for fallback/lookup
DESTINATION_COORDS: Dict[str, tuple[float, float]] = {
    "cox's bazar": (21.4272, 92.0058),
    "cox’s bazar": (21.4272, 92.0058),
    "sylhet": (24.8949, 91.8687),
    "sreemangal": (24.3065, 91.7296),
    "bandarban": (22.1953, 92.2184),
    "sajek": (23.3820, 92.2938),
    "sajek valley": (23.3820, 92.2938),
    "dhaka": (23.8103, 90.4125),
    "saint martin": (20.6277, 92.3223),
    "chattogram": (22.3569, 91.7832),
    "rangamati": (22.6533, 92.1753),
    "khagrachari": (23.1193, 91.9847),
    "sundarbans": (21.9497, 89.1833),
    "kuakata": (21.8167, 90.1167),
    "rajshahi": (24.3745, 88.6042),
    "khulna": (22.8456, 89.5403),
    "barishal": (22.7010, 90.3535),
    "tanguar haor": (25.1328, 91.0772),
}


def resolve_coords_for_name(name: str) -> tuple[float, float]:
    """Resolve latitude & longitude from destination or district name."""
    clean = (name or "").lower().strip()
    for dest_key, coords in DESTINATION_COORDS.items():
        if dest_key in clean or clean in dest_key:
            return coords
    return (23.6850, 90.3563)  # Bangladesh geographic center


def generate_fallback_weather(
    lat: float,
    lon: float,
    location_name: str = "Bangladesh",
) -> dict:
    """Generate realistic seasonal weather data when OpenWeatherMap is unconfigured or unreachable."""
    today = date.today()
    descriptions = [
        ("Partly cloudy", "02d", 28.5, 22.0, 31.0, 65),
        ("Clear sky & sunny", "01d", 29.0, 21.5, 31.5, 60),
        ("Scattered clouds", "03d", 27.5, 23.0, 30.0, 70),
        ("Gentle breeze & mild sun", "02d", 28.0, 22.5, 30.5, 62),
        ("Passing clouds", "03d", 27.0, 21.0, 29.5, 68),
    ]

    forecast = []
    for i in range(1, 6):
        target_date = today + timedelta(days=i)
        desc, icon, avg_t, min_t, max_t, hum = descriptions[(i - 1) % len(descriptions)]
        forecast.append({
            "date": target_date.isoformat(),
            "day": target_date.strftime("%a"),
            "tempMin": min_t,
            "tempMax": max_t,
            "description": desc,
            "icon": icon,
            "humidity": hum,
        })

    return {
        "location": {
            "name": location_name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
        },
        "current": {
            "temp": 28.0,
            "feelsLike": 29.5,
            "humidity": 65,
            "description": "Partly cloudy",
            "icon": "02d",
            "windSpeed": 3.6,
        },
        "forecast": forecast,
        "cached": False,
        "source": "fallback",
        "message": "OpenWeather API key not configured; showing seasonal estimates.",
    }


def parse_openweathermap_response(
    curr_data: dict,
    forecast_data: dict,
    location_name: str,
    lat: float,
    lon: float,
) -> dict:
    """Transform raw OpenWeatherMap API responses into the clean trimmed JSON shape."""
    # 1. Parse current weather
    curr_weather = curr_data.get("weather", [{}])[0]
    curr_main = curr_data.get("main", {})
    curr_wind = curr_data.get("wind", {})

    current = {
        "temp": round(curr_main.get("temp", 28.0), 1),
        "feelsLike": round(curr_main.get("feels_like", 29.0), 1),
        "humidity": curr_main.get("humidity", 65),
        "description": curr_weather.get("description", "Clear").capitalize(),
        "icon": curr_weather.get("icon", "01d"),
        "windSpeed": round(curr_wind.get("speed", 3.0), 1),
    }

    # 2. Parse 5-day forecast grouped by date
    daily_groups: Dict[str, List[dict]] = {}
    today_str = date.today().isoformat()

    for item in forecast_data.get("list", []):
        dt_txt = item.get("dt_txt", "")
        if not dt_txt:
            continue
        day_date = dt_txt.split(" ")[0]
        # Skip today to give the 5 upcoming days
        if day_date == today_str:
            continue
        if day_date not in daily_groups:
            daily_groups[day_date] = []
        daily_groups[day_date].append(item)

    forecast: List[dict] = []
    for day_date in sorted(daily_groups.keys())[:5]:
        items = daily_groups[day_date]
        temps = [it.get("main", {}).get("temp", 25.0) for it in items]
        min_temp = min(temps) if temps else 22.0
        max_temp = max(temps) if temps else 30.0

        # Pick midday forecast (near 12:00:00) or median item for description/icon
        midday_item = next(
            (it for it in items if "12:00:00" in it.get("dt_txt", "")),
            items[len(items) // 2],
        )
        mid_weather = midday_item.get("weather", [{}])[0]
        mid_main = midday_item.get("main", {})

        try:
            day_obj = datetime.strptime(day_date, "%Y-%m-%d").date()
            day_name = day_obj.strftime("%a")
        except Exception:
            day_name = day_date

        forecast.append({
            "date": day_date,
            "day": day_name,
            "tempMin": round(min_temp, 1),
            "tempMax": round(max_temp, 1),
            "description": mid_weather.get("description", "Clear").capitalize(),
            "icon": mid_weather.get("icon", "01d"),
            "humidity": mid_main.get("humidity", 65),
        })

    return {
        "location": {
            "name": curr_data.get("name") or location_name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
        },
        "current": current,
        "forecast": forecast,
        "cached": False,
        "source": "openweathermap",
    }


async def fetch_weather_data(
    lat: float,
    lon: float,
    location_name: str = "Bangladesh",
    client_instance: Optional[httpx.AsyncClient] = None,
) -> dict:
    """
    Fetch current weather and 5-day forecast for a location, utilizing the 30-min in-memory cache.
    Falls back gracefully if OPENWEATHER_API_KEY is not configured or if an error occurs.
    """
    cache_key = f"coord:{round(lat, 2)}:{round(lon, 2)}"
    cached = await weather_cache.get(cache_key)
    if cached:
        return cached

    settings = get_settings()
    api_key = (settings.OPENWEATHER_API_KEY or "").strip()

    if not api_key:
        logger.debug("OPENWEATHER_API_KEY not set; using fallback weather.")
        data = generate_fallback_weather(lat, lon, location_name)
        await weather_cache.set(cache_key, data)
        return data

    try:
        current_url = "https://api.openweathermap.org/data/2.5/weather"
        forecast_url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}

        async def _make_requests(client: httpx.AsyncClient):
            curr_resp, fore_resp = await asyncio.gather(
                client.get(current_url, params=params),
                client.get(forecast_url, params=params),
            )
            return curr_resp, fore_resp

        if client_instance is not None:
            curr_resp, fore_resp = await _make_requests(client_instance)
        else:
            async with httpx.AsyncClient(timeout=10.0) as client:
                curr_resp, fore_resp = await _make_requests(client)

        if curr_resp.status_code == 200 and fore_resp.status_code == 200:
            result = parse_openweathermap_response(
                curr_resp.json(),
                fore_resp.json(),
                location_name,
                lat,
                lon,
            )
            await weather_cache.set(cache_key, result)
            return result
        else:
            logger.warning(
                "OpenWeatherMap API error (curr: %d, fore: %d). Falling back to seasonal data.",
                curr_resp.status_code,
                fore_resp.status_code,
            )
            fallback = generate_fallback_weather(lat, lon, location_name)
            await weather_cache.set(cache_key, fallback)
            return fallback

    except Exception as exc:
        logger.warning("Weather fetch failed (%s: %s). Falling back.", type(exc).__name__, exc)
        fallback = generate_fallback_weather(lat, lon, location_name)
        await weather_cache.set(cache_key, fallback)
        return fallback
