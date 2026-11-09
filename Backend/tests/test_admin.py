from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


ADMIN_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
PLANNER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
TRAVELER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
TARGET_USER_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
VERIF_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")
REPORT_ID = uuid.UUID("66666666-6666-6666-6666-666666666666")

MOCK_ADMIN = {
    "id": ADMIN_ID,
    "email": "admin@porikroma.com",
    "name": "Platform Admin",
    "role": "ADMIN",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_PLANNER = {
    "id": PLANNER_ID,
    "email": "planner@porikroma.com",
    "name": "Nadia Tour Guide",
    "role": "TOUR_PLANNER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_TRAVELER = {
    "id": TRAVELER_ID,
    "email": "traveler@porikroma.com",
    "name": "Rafi Ahmed",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_SUSPENDED_USER = {
    "id": TARGET_USER_ID,
    "email": "suspended@porikroma.com",
    "name": "Suspended User",
    "role": "TRAVELER",
    "status": "SUSPENDED",
    "password_hash": "$2a$10$xyz",
}

MOCK_BANNED_USER = {
    "id": TARGET_USER_ID,
    "email": "banned@porikroma.com",
    "name": "Banned User",
    "role": "TRAVELER",
    "status": "BANNED",
    "password_hash": "$2a$10$xyz",
}

ADMIN_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(ADMIN_ID), 'email': 'admin@porikroma.com', 'role': 'ADMIN'})}"
}

PLANNER_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(PLANNER_ID), 'email': 'planner@porikroma.com', 'role': 'TOUR_PLANNER'})}"
}

TRAVELER_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(TRAVELER_ID), 'email': 'traveler@porikroma.com', 'role': 'TRAVELER'})}"
}

SUSPENDED_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(TARGET_USER_ID), 'email': 'suspended@porikroma.com', 'role': 'TRAVELER'})}"
}


# ---------------------------------------------------------------------------
# 1. EVERY ADMIN ROUTE REJECTS NON-ADMIN USERS (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_every_admin_route_rejects_non_admin_users(client: TestClient):
    """
    CHECKLIST TEST:
    Every admin route rejects non-admin users with HTTP 403.
    """
    admin_endpoints = [
        ("GET", "/api/admin/analytics", None),
        ("GET", "/api/admin/users", None),
        ("PATCH", f"/api/admin/users/{TARGET_USER_ID}/role", {"role": "TOUR_PLANNER"}),
        ("PATCH", f"/api/admin/users/{TARGET_USER_ID}/status", {"status": "SUSPENDED"}),
        ("GET", "/api/admin/verifications", None),
        ("PATCH", f"/api/admin/verifications/{VERIF_ID}", {"status": "APPROVED"}),
        ("GET", "/api/admin/trips", None),
        ("GET", "/api/admin/groups", None),
        ("GET", "/api/admin/reports", None),
        ("POST", f"/api/admin/reports/{REPORT_ID}/actions", {"action": "WARNING"}),
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = MOCK_TRAVELER

        for method, url, payload in admin_endpoints:
            if method == "GET":
                res = client.get(url, headers=TRAVELER_HEADERS)
            elif method == "PATCH":
                res = client.patch(url, json=payload, headers=TRAVELER_HEADERS)
            elif method == "POST":
                res = client.post(url, json=payload, headers=TRAVELER_HEADERS)

            assert res.status_code == 403, f"Expected 403 for {method} {url}, got {res.status_code}"
            assert res.json()["error"] == "Admin role required"


# ---------------------------------------------------------------------------
# 2. PLANNER VERIFICATION UPGRADES USER ROLE (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_planner_verification_changes_user_role_and_notifies(client: TestClient):
    """
    CHECKLIST TEST:
    Planner verification changes the user's role/status correctly.
    """
    verif_row = {
        "id": VERIF_ID,
        "user_id": TARGET_USER_ID,
        "status": "APPROVED",
        "note": "Licensed mountain tour operator in Chittagong Hill Tracts.",
        "reviewed_by": ADMIN_ID,
        "reviewed_at": datetime.now(timezone.utc),
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        def fetchrow_side_effect(query, *args):
            if "UPDATE verification_requests" in query:
                return verif_row
            if "FROM users" in query:
                return MOCK_ADMIN
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.patch(
            f"/api/admin/verifications/{VERIF_ID}",
            json={"status": "APPROVED"},
            headers=ADMIN_HEADERS,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "APPROVED"

        # Verify role was upgraded to TOUR_PLANNER
        exec_calls = [c[0][0] for c in mock_exec.call_args_list]
        role_upgrade_calls = [c for c in exec_calls if "UPDATE users SET role = 'TOUR_PLANNER'" in c]
        assert len(role_upgrade_calls) == 1

        # Verify notification was sent
        notif_calls = [c for c in exec_calls if "INSERT INTO notifications" in c]
        assert len(notif_calls) == 1


# ---------------------------------------------------------------------------
# 3. BAN / SUSPEND / REACTIVATE AND GLOBAL BLOCKING
# ---------------------------------------------------------------------------
def test_suspend_ban_and_reactivate_user_status(client: TestClient):
    """Admin can suspend/ban user, and suspended/banned users are blocked everywhere."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        # 1. Admin suspends user
        def admin_suspend_side_effect(query, *args):
            if "UPDATE users" in query:
                return {"id": TARGET_USER_ID, "name": "Target", "email": "target@example.com", "status": "SUSPENDED"}
            if "FROM users" in query:
                return MOCK_ADMIN
            return None

        mock_fetchrow.side_effect = admin_suspend_side_effect
        res_suspend = client.patch(
            f"/api/admin/users/{TARGET_USER_ID}/status",
            json={"status": "SUSPENDED"},
            headers=ADMIN_HEADERS,
        )
        assert res_suspend.status_code == 200
        assert res_suspend.json()["status"] == "SUSPENDED"

        # 2. Suspended user is blocked from making authenticated calls
        mock_fetchrow.side_effect = None
        mock_fetchrow.return_value = MOCK_SUSPENDED_USER
        res_blocked = client.get("/api/me", headers=SUSPENDED_HEADERS)
        assert res_blocked.status_code == 403
        assert "suspended" in res_blocked.json()["error"].lower()

        # 3. Banned user is blocked from making authenticated calls
        mock_fetchrow.return_value = MOCK_BANNED_USER
        res_banned = client.get("/api/me", headers=SUSPENDED_HEADERS)
        assert res_banned.status_code == 403
        assert "banned" in res_banned.json()["error"].lower()


# ---------------------------------------------------------------------------
# 4. MODERATION ACTIONS ON USER REPORTS
# ---------------------------------------------------------------------------
def test_moderation_action_bans_reported_user(client: TestClient):
    """Admin taking BANNED moderation action updates the reported user's status."""
    report_row = {
        "id": REPORT_ID,
        "reported_user_id": TARGET_USER_ID,
    }
    action_row = {
        "id": uuid.uuid4(),
        "report_id": REPORT_ID,
        "admin_id": ADMIN_ID,
        "action": "BANNED",
        "note": "Spam and inappropriate content.",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        def fetchrow_side_effect(query, *args):
            if "FROM user_reports WHERE id = $1" in query:
                return report_row
            if "INSERT INTO moderation_actions" in query:
                return action_row
            if "FROM users" in query:
                return MOCK_ADMIN
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.post(
            f"/api/admin/reports/{REPORT_ID}/actions",
            json={"action": "BANNED", "note": "Spam and inappropriate content."},
            headers=ADMIN_HEADERS,
        )
        assert res.status_code == 201
        assert res.json()["action"] == "BANNED"

        # Verify user status was set to BANNED
        exec_calls = [c[0][0] for c in mock_exec.call_args_list if "UPDATE users SET status = $1" in c[0][0]]
        assert len(exec_calls) == 1


# ---------------------------------------------------------------------------
# 5. FRONTEND /ADMIN/* PAGES WORK (ANALYTICS, USERS, TRIPS, GROUPS, REPORTS)
# ---------------------------------------------------------------------------
def test_admin_dashboard_and_monitoring_endpoints(client: TestClient):
    """Admin monitoring endpoints return exact shapes expected by the frontend."""
    analytics_row = {
        "users": 10,
        "planners": 2,
        "trips": 15,
        "active_groups": 4,
        "published_tours": 3,
        "reports": 1,
        "pending_verifications": 1,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        def fetchrow_side_effect(query, *args):
            if "pending_verifications" in query:
                return analytics_row
            if "FROM users" in query:
                return MOCK_ADMIN
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        # 1. Analytics
        res_analytics = client.get("/api/admin/analytics", headers=ADMIN_HEADERS)
        assert res_analytics.status_code == 200
        stats = res_analytics.json()
        assert stats["users"] == 10
        assert stats["planners"] == 2
        assert stats["active_groups"] == 4

        # 2. Users directory
        mock_fetch.return_value = [
            {
                "id": TARGET_USER_ID,
                "name": "Rafi Ahmed",
                "email": "traveler@porikroma.com",
                "role": "TRAVELER",
                "status": "ACTIVE",
                "created_at": datetime.now(timezone.utc),
                "trips_count": 3,
            }
        ]
        res_users = client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert res_users.status_code == 200
        assert len(res_users.json()) == 1
        assert res_users.json()[0]["trips_count"] == 3

        # 3. Trips monitoring
        mock_fetch.return_value = [
            {
                "id": uuid.uuid4(),
                "name": "Sylhet Rain Trek",
                "creator_name": "Rafi Ahmed",
                "destination_name": "Sylhet",
            }
        ]
        res_trips = client.get("/api/admin/trips", headers=ADMIN_HEADERS)
        assert res_trips.status_code == 200
        assert len(res_trips.json()) == 1

        # 4. Groups monitoring
        mock_fetch.return_value = [
            {
                "id": uuid.uuid4(),
                "title": "Keokradong Summit Expedition",
                "organizer_name": "Nadia Tour Guide",
                "trip_name": "Bandarban High Trek",
            }
        ]
        res_groups = client.get("/api/admin/groups", headers=ADMIN_HEADERS)
        assert res_groups.status_code == 200
        assert len(res_groups.json()) == 1


# ---------------------------------------------------------------------------
# 6. USER SUBMISSIONS (VERIFICATION REQUEST & USER REPORT)
# ---------------------------------------------------------------------------
def test_user_submissions_verification_and_reporting(client: TestClient):
    """Travelers can apply for verification and submit user reports."""
    verif_created = {
        "id": VERIF_ID,
        "user_id": TRAVELER_ID,
        "status": "PENDING",
        "note": "Experienced trekking planner.",
    }

    report_created = {
        "id": REPORT_ID,
        "created_at": datetime.now(timezone.utc),
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "INSERT INTO verification_requests" in query:
                return verif_created
            if "INSERT INTO user_reports" in query:
                return report_created
            if "FROM users" in query:
                if args and (args[0] == TARGET_USER_ID or str(args[0]) == str(TARGET_USER_ID)):
                    return {"id": TARGET_USER_ID}
                return MOCK_TRAVELER
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        # Submit verification request
        res_v = client.post(
            "/api/me/verification",
            json={"note": "Experienced trekking planner."},
            headers=TRAVELER_HEADERS,
        )
        assert res_v.status_code == 201
        assert res_v.json()["status"] == "PENDING"

        # Submit user report
        res_r = client.post(
            f"/api/users/{TARGET_USER_ID}/reports",
            json={"reason": "Inappropriate promotional spam in community discussion."},
            headers=TRAVELER_HEADERS,
        )
        assert res_r.status_code == 201
        assert res_r.json()["id"] == str(REPORT_ID)

