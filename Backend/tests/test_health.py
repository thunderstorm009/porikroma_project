from unittest.mock import AsyncMock, patch
import pytest
from starlette.testclient import TestClient


def test_api_health_returns_ok(client: TestClient):
    """GET /api/health returns {'status': 'ok'} and status 200."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_health_checks_db_connection(client: TestClient):
    """GET /api/health invokes db.check_connection."""
    with patch("app.routers.health.db.check_connection", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = True
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        mock_check.assert_awaited_once()


def test_cors_allows_origin_with_credentials(client: TestClient):
    """CORS middleware allows arbitrary origin with credentials."""
    test_origin = "http://localhost:5173"
    response = client.get("/api/health", headers={"Origin": test_origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == test_origin
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_preflight_options(client: TestClient):
    """CORS preflight OPTIONS request returns appropriate headers."""
    test_origin = "http://frontend.porikroma.local:3000"
    response = client.options(
        "/api/health",
        headers={
            "Origin": test_origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization,Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == test_origin
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_legacy_health_and_ready_endpoints(client: TestClient):
    """Legacy /health and /ready routes respond based on DB availability."""
    with patch("app.routers.health.db.check_connection", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = True
        h_res = client.get("/health")
        assert h_res.status_code == 200
        assert h_res.json() == {"status": "ok", "database": "ready"}

        r_res = client.get("/ready")
        assert r_res.status_code == 200
        assert r_res.json() == {"status": "ready"}

    with patch("app.routers.health.db.check_connection", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = False
        h_res = client.get("/health")
        assert h_res.status_code == 503
        assert h_res.json() == {"status": "degraded", "database": "unavailable"}

        r_res = client.get("/ready")
        assert r_res.status_code == 503
        assert r_res.json() == {"status": "not_ready", "database": "unavailable"}
