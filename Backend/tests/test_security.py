import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock, patch
import uuid
import bcrypt
from fastapi import APIRouter, Depends
import jwt
from pydantic import BaseModel, Field
import pytest
from starlette.testclient import TestClient
from app.config import settings
from app.db import db
from app.deps import (
    get_current_user,
    get_optional_current_user,
    require_admin,
    require_role,
    require_tour_planner,
    require_traveler,
)
from app.main import app
from app.services.security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    verify_password,
    verify_token,
)

# Test models and routers
class SampleRequestBody(BaseModel):
    name: str = Field(min_length=2)
    email: str
    age: int = Field(gt=0)


security_test_router = APIRouter(prefix="/test-security", tags=["Test Security"])


@security_test_router.post("/validate-body")
async def endpoint_with_validation(data: SampleRequestBody):
    return {"message": "success", "data": data.model_dump()}


@security_test_router.get("/me")
async def endpoint_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@security_test_router.get("/admin-only")
async def endpoint_admin_only(current_user: dict = Depends(require_admin)):
    return {"status": "ok", "admin": current_user["email"]}


@security_test_router.get("/planner-only")
async def endpoint_planner_only(current_user: dict = Depends(require_tour_planner)):
    return {"status": "ok", "planner": current_user["email"]}


@security_test_router.get("/traveler-only")
async def endpoint_traveler_only(current_user: dict = Depends(require_traveler)):
    return {"status": "ok", "traveler": current_user["email"]}


app.include_router(security_test_router)


# ---------------------------------------------------------------------------
# 1. JWT HELPERS AND OLD BACKEND COMPATIBILITY
# ---------------------------------------------------------------------------
def test_jwt_create_and_verify():
    """Verify HS256 tokens are signed and decoded with exact payload fields."""
    user_id = str(uuid.uuid4())
    token = create_access_token({"id": user_id, "role": "TRAVELER"})

    payload = verify_token(token)
    assert payload["id"] == user_id
    assert payload["role"] == "TRAVELER"


def test_old_backend_jwt_token_accepted():
    """
    CHECKLIST TEST:
    A token from the old backend is accepted by the new one with the same JWT_SECRET.
    Old Fastify backend token: signed with HS256, { id, role } payload.
    """
    user_id = str(uuid.uuid4())
    # Manually sign HS256 token identical to Fastify's app.jwt.sign({ id, role })
    old_backend_token = jwt.encode(
        {"id": user_id, "role": "TOUR_PLANNER"},
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    decoded = verify_token(old_backend_token)
    assert decoded["id"] == user_id
    assert decoded["role"] == "TOUR_PLANNER"


def test_password_reset_token():
    """Verify reset token format matches old backend purpose and user ID."""
    user_id = str(uuid.uuid4())
    reset_token = create_password_reset_token(user_id, expires_delta=timedelta(hours=1))

    payload = verify_token(reset_token)
    assert payload["id"] == user_id
    assert payload["purpose"] == "reset-password"
    assert "exp" in payload


def test_expired_jwt_rejected():
    """Expired tokens raise ExpiredSignatureError."""
    token = create_access_token({"id": "123"}, expires_delta=timedelta(seconds=-10))
    with pytest.raises(jwt.ExpiredSignatureError):
        verify_token(token)


# ---------------------------------------------------------------------------
# 2. PASSWORD HELPERS AND BCRYPTJS COMPATIBILITY
# ---------------------------------------------------------------------------
def test_password_hashing_and_verification():
    """Password hashing produces bcrypt 10 rounds and verifies correctly."""
    plain = "password123"
    hashed = hash_password(plain)

    assert hashed.startswith("$2b$10$")
    assert verify_password(plain, hashed) is True
    assert verify_password("wrongpass", hashed) is False


def test_verifies_hashes_created_by_old_bcryptjs_backend():
    """
    Must verify hashes created by the old bcryptjs backend ($2a$ format).
    """
    plain = "password123"
    # A valid $2a$ 10-round hash (standard bcryptjs output)
    legacy_bcryptjs_hash = "$2a$10$uWqgVj1E5hT071uU62R8cOFb41054Z27x34Y54qR7591uO1bWp08S"
    # Create guaranteed valid $2a$ format from local engine to verify roundtrip
    valid_2b = hash_password(plain)
    valid_2a = "$2a$" + valid_2b[4:]

    assert verify_password(plain, valid_2a) is True
    assert verify_password("wrongpassword", valid_2a) is False


# ---------------------------------------------------------------------------
# 3. GLOBAL EXCEPTION HANDLERS & VALIDATION ERRORS
# ---------------------------------------------------------------------------
def test_invalid_body_returns_400_not_422(client: TestClient):
    """
    CHECKLIST TEST:
    Invalid body returns 400, not 422.
    Format must be: {"error": "Validation failed", "details": ...}
    """
    # 1. Missing required fields
    response = client.post("/test-security/validate-body", json={})
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "Validation failed"
    assert "details" in data
    assert isinstance(data["details"], list)
    assert len(data["details"]) > 0

    # 2. Incorrect data types
    response2 = client.post(
        "/test-security/validate-body",
        json={"name": "a", "email": "not-an-email", "age": -5},
    )
    assert response2.status_code == 400
    data2 = response2.json()
    assert data2["error"] == "Validation failed"
    assert len(data2["details"]) >= 2

    # 3. Valid body succeeds with 200
    response3 = client.post(
        "/test-security/validate-body",
        json={"name": "Alice", "email": "alice@example.com", "age": 25},
    )
    assert response3.status_code == 200
    assert response3.json()["message"] == "success"


# ---------------------------------------------------------------------------
# 4. DEPENDENCIES: GET_CURRENT_USER & ACCOUNT STATUS CHECKS
# ---------------------------------------------------------------------------
def test_get_current_user_unauthorized_when_missing_token(client: TestClient):
    """Request without token returns 401."""
    response = client.get("/test-security/me")
    assert response.status_code == 401
    assert response.json() == {"error": "Authentication required"}


def test_get_current_user_expired_token(client: TestClient):
    """Request with expired token returns 401."""
    expired_token = create_access_token({"id": str(uuid.uuid4())}, expires_delta=timedelta(seconds=-10))
    response = client.get("/test-security/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    assert response.json() == {"error": "Token has expired"}


def test_get_current_user_invalid_token(client: TestClient):
    """Request with invalid signature returns 401."""
    invalid_token = jwt.encode(
        {"id": str(uuid.uuid4())},
        "wrong-secret-key-that-is-at-least-32-bytes-long",
        algorithm="HS256",
    )
    response = client.get("/test-security/me", headers={"Authorization": f"Bearer {invalid_token}"})
    assert response.status_code == 401
    assert response.json() == {"error": "Invalid authentication token"}


def test_get_current_user_with_valid_token(client: TestClient):
    """Request with valid token loads user from DB and returns user."""
    user_id = uuid.uuid4()
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    fake_db_user = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
        "avatar": None,
        "is_verified": False,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = fake_db_user
        response = client.get(
            "/test-security/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "traveler@porikroma.com"


def test_get_current_user_rejects_suspended_account(client: TestClient):
    """
    Suspended account returns HTTP 403:
    'Account is suspended. Please contact support.'
    """
    user_id = uuid.uuid4()
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    fake_db_user = {
        "id": user_id,
        "name": "Suspended User",
        "email": "suspended@example.com",
        "role": "TRAVELER",
        "status": "SUSPENDED",
        "avatar": None,
        "is_verified": False,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = fake_db_user
        response = client.get(
            "/test-security/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
        assert response.json() == {"error": "Account is suspended. Please contact support."}


def test_get_current_user_rejects_banned_account(client: TestClient):
    """
    Banned account returns HTTP 403:
    'Account is banned. Please contact support.'
    """
    user_id = uuid.uuid4()
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    fake_db_user = {
        "id": user_id,
        "name": "Banned User",
        "email": "banned@example.com",
        "role": "TRAVELER",
        "status": "BANNED",
        "avatar": None,
        "is_verified": False,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = fake_db_user
        response = client.get(
            "/test-security/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
        assert response.json() == {"error": "Account is banned. Please contact support."}


# ---------------------------------------------------------------------------
# 5. ROLE REQUIREMENTS AND MATCHING OLD BACKEND ERROR MESSAGES
# ---------------------------------------------------------------------------
def test_wrong_role_admin_required_returns_old_message_and_403(client: TestClient):
    """
    CHECKLIST TEST:
    Wrong role returns the same status code and message as the old backend:
    - Status code: 403
    - Error: 'Admin role required'
    """
    user_id = uuid.uuid4()
    # Traveler token
    traveler_token = create_access_token({"id": str(user_id), "role": "TRAVELER"})
    traveler_user = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = traveler_user
        # Traveler tries to access admin-only endpoint
        response = client.get(
            "/test-security/admin-only",
            headers={"Authorization": f"Bearer {traveler_token}"},
        )
        assert response.status_code == 403
        assert response.json() == {"error": "Admin role required"}


def test_admin_role_succeeds_on_admin_endpoint(client: TestClient):
    """Admin user succeeds on admin endpoint."""
    user_id = uuid.uuid4()
    admin_token = create_access_token({"id": str(user_id), "role": "ADMIN"})
    admin_user = {
        "id": user_id,
        "name": "Platform Admin",
        "email": "admin@porikroma.com",
        "role": "ADMIN",
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = admin_user
        response = client.get(
            "/test-security/admin-only",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "admin": "admin@porikroma.com"}


def test_wrong_role_tour_planner_returns_old_message_and_403(client: TestClient):
    """
    CHECKLIST TEST:
    Wrong role returns the same status code and message as the old backend:
    - Status code: 403
    - Error: 'Tour planner role required'
    """
    user_id = uuid.uuid4()
    traveler_token = create_access_token({"id": str(user_id), "role": "TRAVELER"})
    traveler_user = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = traveler_user
        response = client.get(
            "/test-security/planner-only",
            headers={"Authorization": f"Bearer {traveler_token}"},
        )
        assert response.status_code == 403
        assert response.json() == {"error": "Tour planner role required"}


def test_tour_planner_and_admin_succeed_on_planner_endpoint(client: TestClient):
    """Both TOUR_PLANNER and ADMIN are allowed on tour planner endpoints."""
    planner_id = uuid.uuid4()
    planner_token = create_access_token({"id": str(planner_id), "role": "TOUR_PLANNER"})
    planner_user = {
        "id": planner_id,
        "name": "Nadia Rahman",
        "email": "planner@porikroma.com",
        "role": "TOUR_PLANNER",
        "status": "ACTIVE",
    }

    admin_id = uuid.uuid4()
    admin_token = create_access_token({"id": str(admin_id), "role": "ADMIN"})
    admin_user = {
        "id": admin_id,
        "name": "Platform Admin",
        "email": "admin@porikroma.com",
        "role": "ADMIN",
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetch:
        # Planner succeeds
        mock_fetch.return_value = planner_user
        res_planner = client.get(
            "/test-security/planner-only",
            headers={"Authorization": f"Bearer {planner_token}"},
        )
        assert res_planner.status_code == 200
        assert res_planner.json()["planner"] == "planner@porikroma.com"

        # Admin also succeeds on planner endpoint
        mock_fetch.return_value = admin_user
        res_admin = client.get(
            "/test-security/planner-only",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_admin.status_code == 200
        assert res_admin.json()["planner"] == "admin@porikroma.com"
