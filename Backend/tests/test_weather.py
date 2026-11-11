from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import httpx
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.weather import weather_cache

DEST_ID = uuid.UUID("77777777-7777-7777-7777-777777777777")

MOCK_DESTINATION = {
    "id": DEST_ID,
    "name": "Cox's Bazar",
    "district": "Cox's Bazar",
    "division": "Chattogram",
}

OPENWEATHER_CURR_RESPONSE = {
    "name": "Cox's Bazar",
    "coord": {"lat": 21.4272, "lon": 92.0058},
    "weather": [{"id": 801, "main": "Clouds", "description": "few clouds", "icon": "02d"}],
    "main": {"temp": 29.4, "feels_like": 32.1, "humidity": 68},
    "wind": {"speed": 4.1},
}

OPENWEATHER_FORECAST_RESPONSE = {
    "list": [
        {
            "dt_txt": "2026-11-12 12:00:00",
            "main": {"temp": 30.5, "humidity": 62},
            "weather": [{"description": "clear sky", "icon": "01d"}],
        },
        {
            "dt_txt": "2026-11-13 12:00:00",
            "main": {"temp": 28.2, "humidity": 70},
            "weather": [{"description": "scattered clouds", "icon": "03d"}],
        },
        {
            "dt_txt": "2026-11-14 12:00:00",
            "main": {"temp": 27.8, "humidity": 65},
            "weather": [{"description": "few clouds", "icon": "02d"}],
        },
    ]
}


def test_weather_fallback_when_key_empty(client: TestClient):
    """When OPENWEATHER_API_KEY is not set, returns valid trimmed fallback weather without breaking."""
    weather_cache._cache.clear()

    with patch("app.services.weather.get_settings") as mock_settings:
        cfg = MagicMock()
        cfg.OPENWEATHER_API_KEY = ""
        mock_settings.return_value = cfg

        res = client.get("/api/weather?lat=21.4272&lon=92.0058")
        assert res.status_code == 200
        data = res.json()

        assert "current" in data
        assert "temp" in data["current"]
        assert "feelsLike" in data["current"]
        assert "description" in data["current"]
        assert "icon" in data["current"]
        assert "forecast" in data
        assert len(data["forecast"]) >= 3
        assert data["source"] == "fallback"
        assert data["cached"] is False

        # Key should never reach browser/response
        assert "key" not in data
        assert "OPENWEATHER_API_KEY" not in str(data)


def test_repeated_weather_requests_hit_cache(client: TestClient):
    """Repeated requests for the same location within 30 minutes hit the cache."""
    weather_cache._cache.clear()

    with patch("app.services.weather.get_settings") as mock_settings:
        cfg = MagicMock()
        cfg.OPENWEATHER_API_KEY = ""
        mock_settings.return_value = cfg

        # First request: not cached
        res1 = client.get("/api/weather?lat=24.8949&lon=91.8687")
        assert res1.status_code == 200
        assert res1.json()["cached"] is False

        # Second request: hits the in-memory cache
        res2 = client.get("/api/weather?lat=24.8949&lon=91.8687")
        assert res2.status_code == 200
        assert res2.json()["cached"] is True
        assert res2.json()["current"]["temp"] == res1.json()["current"]["temp"]


def test_weather_with_real_api_response_mocked(client: TestClient):
    """When API returns valid OpenWeatherMap data, it is parsed into the trimmed shape."""
    weather_cache._cache.clear()

    mock_curr = MagicMock()
    mock_curr.status_code = 200
    mock_curr.json.return_value = OPENWEATHER_CURR_RESPONSE

    mock_fore = MagicMock()
    mock_fore.status_code = 200
    mock_fore.json.return_value = OPENWEATHER_FORECAST_RESPONSE

    with patch("app.services.weather.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        cfg = MagicMock()
        cfg.OPENWEATHER_API_KEY = "test-openweather-key"
        mock_settings.return_value = cfg
        mock_get.side_effect = [mock_curr, mock_fore]

        res = client.get("/api/weather?lat=21.4272&lon=92.0058")
        assert res.status_code == 200
        data = res.json()

        assert data["source"] == "openweathermap"
        assert data["current"]["temp"] == 29.4
        assert data["current"]["feelsLike"] == 32.1
        assert data["current"]["description"] == "Few clouds"
        assert data["current"]["icon"] == "02d"
        assert len(data["forecast"]) >= 1

        # Key is not exposed
        assert "test-openweather-key" not in res.text


def test_weather_graceful_fallback_on_api_error(client: TestClient):
    """If OpenWeatherMap fails (HTTP 500 or timeout), falls back quietly without crashing."""
    weather_cache._cache.clear()

    with patch("app.services.weather.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        cfg = MagicMock()
        cfg.OPENWEATHER_API_KEY = "test-openweather-key"
        mock_settings.return_value = cfg
        mock_get.side_effect = httpx.ConnectTimeout("Connection to OpenWeatherMap timed out")

        res = client.get("/api/weather?lat=22.1953&lon=92.2184")
        assert res.status_code == 200
        data = res.json()

        assert data["source"] == "fallback"
        assert "temp" in data["current"]
        assert len(data["forecast"]) > 0


def test_weather_destination_id_lookup(client: TestClient):
    """Weather endpoint resolves destination ID to coordinates via database."""
    weather_cache._cache.clear()

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch("app.services.weather.get_settings") as mock_settings:

        mock_fetchrow.return_value = MOCK_DESTINATION
        cfg = MagicMock()
        cfg.OPENWEATHER_API_KEY = ""
        mock_settings.return_value = cfg

        res = client.get(f"/api/weather?destination_id={DEST_ID}")
        assert res.status_code == 200
        data = res.json()
        assert data["location"]["name"] == "Cox's Bazar"
        assert abs(data["location"]["lat"] - 21.4272) < 0.1

