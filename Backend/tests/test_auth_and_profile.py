from datetime import timedelta
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    verify_password,
    verify_token,
)


# ---------------------------------------------------------------------------
# 1. REGISTER, LOGIN, AND DEMO-LOGIN RESPONSE SHAPES
# ---------------------------------------------------------------------------
def test_register_returns_exact_shape(client: TestClient):
    """Register returns 201 with { user: { id, name, email, role }, token: string }."""
    new_user_id = uuid.uuid4()
    user_row = {
        "id": new_user_id,
        "name": "Nafis Fuad",
        "email": "nafis@example.com",
        "role": "TRAVELER",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.return_value = user_row
        mock_execute.return_value = "INSERT 0 1"

        response = client.post(
            "/api/auth/register",
            json={
                "name": "Nafis Fuad",
                "email": "nafis@example.com",
                "password": "secretpassword",
                "role": "TRAVELER",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert "token" in data
        assert data["user"]["id"] == str(new_user_id)
        assert data["user"]["name"] == "Nafis Fuad"
        assert data["user"]["email"] == "nafis@example.com"
        assert data["user"]["role"] == "TRAVELER"

        # Verify token payload
        token_payload = verify_token(data["token"])
        assert token_payload["id"] == str(new_user_id)
        assert token_payload["role"] == "TRAVELER"


def test_login_returns_exact_shape(client: TestClient):
    """Login returns 200 with { user: { id, name, email, role, status }, token: string }."""
    user_id = uuid.uuid4()
    pwd_hash = hash_password("password123")
    user_row = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "password_hash": pwd_hash,
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = user_row

        response = client.post(
            "/api/auth/login",
            json={"email": "traveler@porikroma.com", "password": "password123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "token" in data
        assert "password_hash" not in data["user"]
        assert data["user"]["email"] == "traveler@porikroma.com"
        assert data["user"]["role"] == "TRAVELER"


def test_login_invalid_password_returns_401(client: TestClient):
    """Login with wrong credentials returns 401 'Invalid email or password'."""
    user_id = uuid.uuid4()
    pwd_hash = hash_password("password123")
    user_row = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "password_hash": pwd_hash,
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = user_row

        response = client.post(
            "/api/auth/login",
            json={"email": "traveler@porikroma.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert response.json() == {"error": "Invalid email or password"}


def test_login_suspended_account_returns_403(client: TestClient):
    """Login with suspended user returns 403 'Account is suspended. Please contact support.'"""
    user_id = uuid.uuid4()
    pwd_hash = hash_password("password123")
    user_row = {
        "id": user_id,
        "name": "Suspended User",
        "email": "suspended@example.com",
        "role": "TRAVELER",
        "password_hash": pwd_hash,
        "status": "SUSPENDED",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = user_row

        response = client.post(
            "/api/auth/login",
            json={"email": "suspended@example.com", "password": "password123"},
        )
        assert response.status_code == 403
        assert response.json() == {"error": "Account is suspended. Please contact support."}


def test_demo_login_for_each_role(client: TestClient):
    """Demo login for TRAVELER, TOUR_PLANNER, and ADMIN returns { user, token }."""
    for role, expected_email in [
        ("TRAVELER", "traveler@porikroma.com"),
        ("TOUR_PLANNER", "planner@porikroma.com"),
        ("ADMIN", "admin@porikroma.com"),
    ]:
        user_id = uuid.uuid4()
        user_row = {
            "id": user_id,
            "name": f"Demo {role}",
            "email": expected_email,
            "role": role,
            "status": "ACTIVE",
        }

        with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
            mock_fetchrow.return_value = user_row
            response = client.post(
                "/api/auth/demo-login",
                json={"role": role},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["user"]["role"] == role
            assert data["user"]["email"] == expected_email
            assert "token" in data


# ---------------------------------------------------------------------------
# 2. FORGOT, RESET, VERIFY AND CHANGE PASSWORD FLOWS
# ---------------------------------------------------------------------------
def test_forgot_and_reset_password_flow(client: TestClient):
    """Forgot password generates signed reset JWT; reset password updates hash."""
    user_id = uuid.uuid4()
    user_row = {"id": user_id, "email": "traveler@porikroma.com"}

    # 1. Forgot password request
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = user_row
        forgot_res = client.post(
            "/api/auth/forgot-password",
            json={"email": "traveler@porikroma.com"},
        )
        assert forgot_res.status_code == 200
        forgot_data = forgot_res.json()
        assert forgot_data["success"] is True
        assert "resetToken" in forgot_data
        assert "resetLink" in forgot_data
        token = forgot_data["resetToken"]

    # 2. Reset password request with the generated token
    with patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = "UPDATE 1"
        reset_res = client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "brandnewpassword123"},
        )
        assert reset_res.status_code == 200
        assert reset_res.json()["success"] is True
        mock_execute.assert_awaited_once()


def test_verify_email_returns_success(client: TestClient):
    """Verify email endpoint returns success true message."""
    response = client.post(
        "/api/auth/verify-email",
        json={"token": "some-verification-token"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "message": "Email verified successfully.",
    }


def test_change_password_flow(client: TestClient):
    """Authenticated user changes password when providing correct current password."""
    user_id = uuid.uuid4()
    old_hash = hash_password("oldpassword123")
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    user_db_record = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
        "password_hash": old_hash,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.return_value = user_db_record
        mock_execute.return_value = "UPDATE 1"

        # 1. Incorrect current password -> 400
        bad_res = client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"currentPassword": "wrongoldpassword", "newPassword": "newsecretpass123"},
        )
        assert bad_res.status_code == 400
        assert bad_res.json() == {"error": "Current password does not match"}

        # 2. Correct current password -> 200
        good_res = client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"currentPassword": "oldpassword123", "newPassword": "newsecretpass123"},
        )
        assert good_res.status_code == 200
        assert good_res.json() == {
            "success": True,
            "message": "Password updated successfully",
        }


# ---------------------------------------------------------------------------
# 3. GET CURRENT USER, PROFILE, AND PRIVACY SETTINGS
# ---------------------------------------------------------------------------
def test_get_current_user_me(client: TestClient):
    """GET /api/me returns authenticated user's core details."""
    user_id = uuid.uuid4()
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})
    user_record = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "created_at": "2025-01-01T00:00:00Z",
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = user_record
        res = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == str(user_id)
        assert data["email"] == "traveler@porikroma.com"


def test_get_and_update_profile(client: TestClient):
    """GET and PUT /api/me/profile loads and updates user profile."""
    user_id = uuid.uuid4()
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    profile_row = {
        "id": user_id,
        "user_id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "created_at": "2025-01-01T00:00:00Z",
        "username": "rafi-ahmed-101",
        "bio": "Explorer of the hills",
        "avatar_url": "https://example.com/avatar.jpg",
        "travel_style": "Slow explorer",
        "interests": ["Hiking", "Photography"],
        "trips_count": 3,
        "review_count": 5,
        "rating": 4.9,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # 1. GET /api/me/profile
        mock_fetchrow.return_value = profile_row
        get_res = client.get("/api/me/profile", headers={"Authorization": f"Bearer {token}"})
        assert get_res.status_code == 200
        assert get_res.json()["username"] == "rafi-ahmed-101"
        assert get_res.json()["trips_count"] == 3

        # 2. PUT /api/me/profile
        mock_execute.return_value = "UPDATE 1"
        # Return profile row then user row
        mock_fetchrow.side_effect = [
            profile_row,  # auth lookup
            profile_row,  # profile upsert
            {"name": "Rafi Ahmed Updated", "email": "traveler@porikroma.com", "role": "TRAVELER"},  # updated user
        ]
        put_res = client.put(
            "/api/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Rafi Ahmed Updated",
                "bio": "New bio details",
                "avatarUrl": "https://example.com/new.jpg",
                "travelStyle": "Backpacker",
                "interests": ["River", "Food"],
            },
        )
        assert put_res.status_code == 200
        assert put_res.json()["name"] == "Rafi Ahmed Updated"


def test_get_and_update_privacy_settings(client: TestClient):
    """GET and PUT /api/me/privacy returns visibility settings in both cases."""
    user_id = uuid.uuid4()
    token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    user_record = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
    }
    privacy_row = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "profile_visibility": "PUBLIC",
        "travel_history_visibility": "PRIVATE",
        "footprint_visibility": "PUBLIC",
        "reviews_visibility": "PUBLIC",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        # 1. GET /api/me/privacy
        mock_fetchrow.side_effect = [
            user_record,  # auth lookup
            privacy_row,  # settings lookup
        ]
        get_res = client.get("/api/me/privacy", headers={"Authorization": f"Bearer {token}"})
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["profileVisibility"] == "PUBLIC"
        assert data["travelHistoryVisibility"] == "PRIVATE"

        # 2. PUT /api/me/privacy
        mock_fetchrow.side_effect = [
            user_record,  # auth lookup
            {
                **privacy_row,
                "profile_visibility": "PRIVATE",
                "travel_history_visibility": "PRIVATE",
                "footprint_visibility": "PRIVATE",
                "reviews_visibility": "PRIVATE",
            },
        ]
        put_res = client.put(
            "/api/me/privacy",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "profileVisibility": "PRIVATE",
                "travelHistoryVisibility": "PRIVATE",
                "footprintVisibility": "PRIVATE",
                "reviewsVisibility": "PRIVATE",
            },
        )
        assert put_res.status_code == 200
        assert put_res.json()["profileVisibility"] == "PRIVATE"
