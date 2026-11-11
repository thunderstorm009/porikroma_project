import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import httpx
import pytest
from starlette.testclient import TestClient
from app.config import get_settings
from app.db import db
from app.services.email import (
    booking_cancelled_template,
    booking_confirmed_template,
    departure_reminder_template,
    email_verification_template,
    group_application_approved_template,
    group_application_rejected_template,
    password_reset_template,
    send_email,
)

USER_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")
MOCK_USER = {
    "id": USER_ID,
    "name": "Nabil Hasan",
    "email": "nabil@porikroma.com",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}


def test_email_templates_never_contain_passwords_or_raw_tokens():
    """Emails never include passwords or raw tokens beyond the link parameter."""
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"
    reset_link = f"http://localhost:5173/reset-password?token={token}"
    verify_link = f"http://localhost:5173/verify-email?token={token}"

    # 1. Verification
    subj_v, html_v = email_verification_template(verify_link, "Nabil")
    assert "Verify your Porikroma" in subj_v
    assert f'href="{verify_link}"' in html_v
    assert "password" not in html_v.lower()

    # 2. Reset password
    subj_r, html_r = password_reset_template(reset_link, "Nabil")
    assert "Reset your Porikroma account password" in subj_r
    assert f'href="{reset_link}"' in html_r
    assert "password" in html_r.lower()  # referring to the concept, not a password value
    assert "brandnewpassword" not in html_r
    # Raw token should only exist inside the action link URL (button href, fallback link href, fallback link text)
    assert html_r.count(token) == 3

    # 3. Booking confirmed
    subj_bc, html_bc = booking_confirmed_template(
        "Nabil", "Cox's Bazar Escape", "2026-11-20", 2, 17000, "b12345678", "http://localhost:5173/my-bookings"
    )
    assert "Booking Confirmed: Cox's Bazar Escape" in subj_bc
    assert "৳17,000" in html_bc
    assert "2026-11-20" in html_bc

    # 4. Booking cancelled
    subj_bx, html_bx = booking_cancelled_template(
        "Nabil", "Sylhet Tea Retreat", "2026-11-25", "User requested", "http://localhost:5173/tours"
    )
    assert "Booking Update: Sylhet Tea Retreat Cancelled" in subj_bx

    # 5. Group application approved
    subj_ga, html_ga = group_application_approved_template(
        "Nabil", "Sajek Valley Cloud Trekkers", "http://localhost:5173/trips/t1"
    )
    assert "Application Approved: Welcome to Sajek Valley Cloud Trekkers!" in subj_ga

    # 6. Group application rejected
    subj_gr, html_gr = group_application_rejected_template(
        "Nabil", "Bandarban High Summit", "http://localhost:5173/community"
    )
    assert "Application Update: Bandarban High Summit" in subj_gr

    # 7. Departure reminder
    subj_dr, html_dr = departure_reminder_template(
        "Nabil", "Keokradong Summit Expedition", "2026-12-01", "Ruma Bazar Ghat", "http://localhost:5173/my-bookings"
    )
    assert "Departure Reminder" in subj_dr
    assert "Ruma Bazar Ghat" in html_dr


def test_send_email_console_fallback_when_no_key():
    """No key means console fallback, not a crash."""
    with patch("app.services.email.get_settings") as mock_settings:
        cfg = MagicMock()
        cfg.EMAIL_PROVIDER = "resend"
        cfg.EMAIL_API_KEY = ""
        cfg.EMAIL_FROM = "Porikroma <notifications@porikroma.com>"
        mock_settings.return_value = cfg

        success = asyncio.run(
            send_email("test@example.com", "Test Subject", "<p>Hello world</p>")
        )
        assert success is True


def test_send_email_resend_delivery():
    """Delivery via Resend provider calls the Resend API."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("app.services.email.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:

        cfg = MagicMock()
        cfg.EMAIL_PROVIDER = "resend"
        cfg.EMAIL_API_KEY = "re_test_123"
        cfg.EMAIL_FROM = "Porikroma <onboarding@resend.dev>"
        mock_settings.return_value = cfg
        mock_post.return_value = mock_resp

        success = asyncio.run(
            send_email("traveler@porikroma.com", "Welcome", "<p>Content</p>")
        )
        assert success is True
        mock_post.assert_awaited_once()
        assert "api.resend.com" in mock_post.call_args[0][0]


def test_send_email_postmark_delivery():
    """Delivery via Postmark provider calls the Postmark API."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("app.services.email.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:

        cfg = MagicMock()
        cfg.EMAIL_PROVIDER = "postmark"
        cfg.EMAIL_API_KEY = "pm_test_token"
        cfg.EMAIL_FROM = "Porikroma <info@porikroma.com>"
        mock_settings.return_value = cfg
        mock_post.return_value = mock_resp

        success = asyncio.run(
            send_email("traveler@porikroma.com", "Welcome", "<p>Content</p>")
        )
        assert success is True
        mock_post.assert_awaited_once()
        assert "api.postmarkapp.com" in mock_post.call_args[0][0]


def test_send_email_graceful_fallback_on_api_failure():
    """If the provider API fails or times out, logs fallback without crashing."""
    with patch("app.services.email.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:

        cfg = MagicMock()
        cfg.EMAIL_PROVIDER = "resend"
        cfg.EMAIL_API_KEY = "re_test_key"
        cfg.EMAIL_FROM = "Porikroma <info@porikroma.com>"
        mock_settings.return_value = cfg
        mock_post.side_effect = httpx.ConnectTimeout("Connection to Resend timed out")

        # Must not raise an exception
        success = asyncio.run(
            send_email("traveler@porikroma.com", "Subject", "<p>Body</p>")
        )
        assert success is False


def test_forgot_password_dispatches_background_email(client: TestClient):
    """Forgot password triggers background email dispatch with link pointing to FRONTEND_URL."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch("app.routers.auth.send_password_reset_email", new_callable=AsyncMock) as mock_send_email, \
         patch("app.routers.auth.settings") as mock_settings:

        mock_settings.FRONTEND_URL = "http://localhost:5173"
        mock_fetchrow.return_value = MOCK_USER

        res = client.post(
            "/api/auth/forgot-password",
            json={"email": "nabil@porikroma.com"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "resetToken" in data

        # Background task executed and link contains FRONTEND_URL
        mock_send_email.assert_awaited_once()
        call_args = mock_send_email.call_args[0]
        assert call_args[0] == "nabil@porikroma.com"
        assert "http://localhost:5173/reset-password?token=" in call_args[1]


def test_send_verification_email_endpoint(client: TestClient):
    """POST /api/auth/send-verification dispatches verification email with FRONTEND_URL link."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch("app.routers.auth.send_verification_email", new_callable=AsyncMock) as mock_send_email, \
         patch("app.routers.auth.settings") as mock_settings:

        mock_settings.FRONTEND_URL = "https://porikroma.com"
        mock_fetchrow.return_value = MOCK_USER

        res = client.post(
            "/api/auth/send-verification",
            json={"email": "nabil@porikroma.com"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

        mock_send_email.assert_awaited_once()
        call_args = mock_send_email.call_args[0]
        assert call_args[0] == "nabil@porikroma.com"
        assert "https://porikroma.com/verify-email?token=" in call_args[1]
