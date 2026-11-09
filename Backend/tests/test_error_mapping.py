from unittest.mock import AsyncMock, patch
import asyncpg
from fastapi import APIRouter
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.main import app

error_test_router = APIRouter(prefix="/test-errors", tags=["Test Errors"])


@error_test_router.get("/unique-violation")
async def trigger_unique_violation():
    raise asyncpg.UniqueViolationError("duplicate key value violates unique constraint")


@error_test_router.get("/postgres-conn-error")
async def trigger_postgres_conn_error():
    raise asyncpg.PostgresConnectionError("connection to server was lost")


@error_test_router.get("/cannot-connect-error")
async def trigger_cannot_connect_error():
    raise asyncpg.CannotConnectNowError("the database system is starting up")


@error_test_router.get("/admin-shutdown")
async def trigger_admin_shutdown():
    raise asyncpg.AdminShutdownError("terminating connection due to administrator command")


@error_test_router.get("/interface-error")
async def trigger_interface_error():
    raise asyncpg.InterfaceError("Database is unavailable. Start PostgreSQL and try again.")


@error_test_router.get("/connection-refused")
async def trigger_connection_refused():
    raise ConnectionRefusedError("[Errno 111] Connect call failed")


@error_test_router.get("/db-query-stopped")
async def trigger_db_query_when_stopped():
    # Attempting to fetch when DB pool is disconnected
    return await db.fetch("SELECT 1")


app.include_router(error_test_router)


def test_unique_violation_returns_409(client: TestClient):
    """UniqueViolationError maps to 409 with exact message 'That record already exists'."""
    response = client.get("/test-errors/unique-violation")
    assert response.status_code == 409
    assert response.json() == {"error": "That record already exists"}


def test_postgres_connection_error_returns_503(client: TestClient):
    """PostgresConnectionError maps to 503 with exact unavailable message."""
    response = client.get("/test-errors/postgres-conn-error")
    assert response.status_code == 503
    assert response.json() == {"error": "Database is unavailable. Start PostgreSQL and try again."}


def test_cannot_connect_now_returns_503(client: TestClient):
    """CannotConnectNowError maps to 503 with exact unavailable message."""
    response = client.get("/test-errors/cannot-connect-error")
    assert response.status_code == 503
    assert response.json() == {"error": "Database is unavailable. Start PostgreSQL and try again."}


def test_admin_shutdown_returns_503(client: TestClient):
    """AdminShutdownError maps to 503 with exact unavailable message."""
    response = client.get("/test-errors/admin-shutdown")
    assert response.status_code == 503
    assert response.json() == {"error": "Database is unavailable. Start PostgreSQL and try again."}


def test_interface_error_returns_503(client: TestClient):
    """InterfaceError maps to 503 with exact unavailable message."""
    response = client.get("/test-errors/interface-error")
    assert response.status_code == 503
    assert response.json() == {"error": "Database is unavailable. Start PostgreSQL and try again."}


def test_connection_refused_returns_503(client: TestClient):
    """ConnectionRefusedError maps to 503 with exact unavailable message."""
    response = client.get("/test-errors/connection-refused")
    assert response.status_code == 503
    assert response.json() == {"error": "Database is unavailable. Start PostgreSQL and try again."}


def test_stopped_postgres_db_query_returns_503(client: TestClient):
    """Stopping Postgres makes queries raise and return 503 message."""
    with patch.object(db, "pool", None):
        response = client.get("/test-errors/db-query-stopped")
        assert response.status_code == 503
        assert response.json() == {"error": "Database is unavailable. Start PostgreSQL and try again."}
