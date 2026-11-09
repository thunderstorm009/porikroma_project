from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


ADMIN_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
PLANNER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
TRAVELER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
DEST_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
TRIP_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")
CONVO_ID = uuid.UUID("66666666-6666-6666-6666-666666666666")

ADMIN_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(ADMIN_ID), 'email': 'admin@porikroma.com', 'role': 'ADMIN'})}"
}
TRAVELER_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(TRAVELER_ID), 'email': 'traveler@porikroma.com', 'role': 'TRAVELER'})}"
}

MOCK_USER = {
    "id": TRAVELER_ID,
    "email": "traveler@porikroma.com",
    "name": "Rafi Ahmed",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "avatar": None,
    "is_verified": False,
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),
}

MOCK_ADMIN = {
    "id": ADMIN_ID,
    "email": "admin@porikroma.com",
    "name": "Platform Admin",
    "role": "ADMIN",
    "status": "ACTIVE",
    "avatar": None,
    "is_verified": True,
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),
}


# ---------------------------------------------------------------------------
# 1. HEALTH ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_health_router(client: TestClient):
    """Verify /api/health and legacy /health return expected contract shapes."""
    with patch.object(db, "check_connection", new_callable=AsyncMock) as mock_conn:
        mock_conn.return_value = True

        res_api = client.get("/api/health")
        assert res_api.status_code == 200
        assert res_api.json()["status"] == "ok"

        res_leg = client.get("/health")
        assert res_leg.status_code == 200
        data_leg = res_leg.json()
        assert "status" in data_leg
        assert "database" in data_leg


# ---------------------------------------------------------------------------
# 2. AUTH ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_auth_router(client: TestClient):
    """Verify POST /api/auth/demo-login returns token and complete user shape."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = {
            "id": TRAVELER_ID,
            "name": "Rafi Ahmed",
            "email": "traveler@porikroma.com",
            "role": "TRAVELER",
            "status": "ACTIVE",
        }
        res = client.post("/api/auth/demo-login", json={"role": "TRAVELER"})
        assert res.status_code == 200
        data = res.json()
        assert set(data.keys()) >= {"user", "token"}
        expected_user_keys = {"id", "email", "name", "role", "status"}
        assert expected_user_keys.issubset(set(data["user"].keys()))


# ---------------------------------------------------------------------------
# 3. USERS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_users_router(client: TestClient):
    """Verify GET /api/me/profile and /api/me/privacy return expected profile/privacy keys."""
    profile_row = {
        "id": TRAVELER_ID,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "created_at": datetime.now(timezone.utc),
        "username": "rafi-ahmed",
        "bio": "Travel enthusiast",
        "avatar_url": None,
        "travel_style": "Explorer",
        "interests": ["Nature", "Trekking"],
        "trips_count": 3,
        "review_count": 5,
        "rating": 4.8,
    }
    privacy_row = {
        "user_id": TRAVELER_ID,
        "profile_visible": True,
        "trip_history_visible": True,
        "footprint_visible": True,
        "reviews_visible": True,
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users u" in query and "user_profiles" in query:
                return profile_row
            if "FROM user_privacy_settings" in query:
                return privacy_row
            if "FROM users" in query:
                return MOCK_USER
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        # Profile contract
        res_prof = client.get("/api/me/profile", headers=TRAVELER_HEADERS)
        assert res_prof.status_code == 200
        prof = res_prof.json()
        expected_prof_keys = {"id", "name", "email", "role", "username", "bio", "travel_style", "interests", "rating"}
        assert expected_prof_keys.issubset(set(prof.keys()))

        # Privacy contract
        res_priv = client.get("/api/me/privacy", headers=TRAVELER_HEADERS)
        assert res_priv.status_code == 200
        priv = res_priv.json()
        expected_priv_keys = {"user_id", "profile_visible", "trip_history_visible", "footprint_visible", "reviews_visible"}
        assert expected_priv_keys.issubset(set(priv.keys()))


# ---------------------------------------------------------------------------
# 4. DESTINATIONS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_destinations_router(client: TestClient):
    """Verify GET /api/destinations returns list with standard destination shape."""
    dest_row = {
        "id": DEST_ID,
        "name": "Sreemangal Tea Capital",
        "division": "Sylhet Division",
        "district": "Moulvibazar",
        "category": "Nature",
        "rating": 4.9,
        "estimated_budget": 8000,
        "cover_image": "https://example.com/sreemangal.jpg",
    }
    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = [dest_row]
        res = client.get("/api/destinations")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "name", "division", "district", "category", "rating", "estimated_budget"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 5. REVIEWS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_reviews_router(client: TestClient):
    """Verify GET /api/destinations/{id}/reviews returns list of reviews with author details."""
    review_row = {
        "id": uuid.uuid4(),
        "destination_id": DEST_ID,
        "user_id": TRAVELER_ID,
        "rating": 5,
        "comment": "Serene tea garden walk in the morning mist.",
        "user_name": "Rafi Ahmed",
        "created_at": datetime.now(timezone.utc),
    }
    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = [review_row]
        res = client.get(f"/api/destinations/{DEST_ID}/reviews")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "destination_id", "user_id", "rating", "comment", "user_name"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 6. TRIPS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_trips_router(client: TestClient):
    """Verify GET /api/trips returns list of user trips with required metadata."""
    trip_row = {
        "id": TRIP_ID,
        "creator_id": TRAVELER_ID,
        "destination_id": DEST_ID,
        "name": "Rain & River Expedition",
        "start_date": "2025-07-10",
        "end_date": "2025-07-14",
        "budget": 35000,
        "visibility": "PUBLIC",
        "status": "PLANNING",
        "destination_name": "Sylhet",
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER
        mock_fetch.return_value = [trip_row]

        res = client.get("/api/trips", headers=TRAVELER_HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "creator_id", "name", "destination_name", "start_date", "end_date", "budget", "visibility", "status"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 7. EXPENSES ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_expenses_router(client: TestClient):
    """Verify GET /api/expenses/overview returns aggregate totals and category breakdown."""
    mock_expenses = [
        {"id": uuid.uuid4(), "amount": 6000, "category": "Stay", "title": "Hotel"},
        {"id": uuid.uuid4(), "amount": 2500, "category": "Food", "title": "Dinners"},
    ]
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        def fetchrow_side_effect(query, *args):
            if "total_budget" in query:
                return {"total_budget": 50000}
            if "FROM users" in query:
                return MOCK_USER
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        mock_fetch.return_value = mock_expenses

        res = client.get("/api/expenses/overview", headers=TRAVELER_HEADERS)
        assert res.status_code == 200
        data = res.json()
        expected_keys = {"expenses", "totalSpent", "totalBudget", "categories"}
        assert expected_keys.issubset(set(data.keys()))
        assert isinstance(data["categories"], dict)
        assert data["totalSpent"] == 8500


# ---------------------------------------------------------------------------
# 8. GROUPS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_groups_router(client: TestClient):
    """Verify GET /api/groups returns list of discoverable expeditions with member counts."""
    group_row = {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "title": "Sylhet Monsoon Trek",
        "capacity": 5,
        "budget_per_person": 7000,
        "published": True,
        "destination_name": "Sylhet",
        "organizer_name": "Rafi Ahmed",
        "members_count": 2,
    }
    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = [group_row]
        res = client.get("/api/groups")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "trip_id", "title", "capacity", "budget_per_person", "published", "destination_name", "organizer_name", "members_count"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 9. NOTIFICATIONS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_notifications_router(client: TestClient):
    """Verify GET /api/notifications returns list of user alerts with read states."""
    notif_row = {
        "id": uuid.uuid4(),
        "user_id": TRAVELER_ID,
        "title": "Expedition Joined",
        "message": "Samira joined your Sylhet trip.",
        "type": "GROUP_JOIN",
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER
        mock_fetch.return_value = [notif_row]

        res = client.get("/api/notifications", headers=TRAVELER_HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "user_id", "title", "message", "type", "read", "created_at"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 10. PASSPORT ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_passport_router(client: TestClient):
    """Verify GET /api/me/footprint returns 64-district footprint payload."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER

        def fetch_side_effect(query, *args):
            if "DISTINCT d.district" in query:
                return [{"district": "Sylhet"}]
            if "FROM trips t" in query:
                return [{
                    "id": TRIP_ID,
                    "name": "Sylhet Monsoon Trek",
                    "start_date": date(2025, 7, 10),
                    "end_date": date(2025, 7, 14),
                    "status": "COMPLETED",
                    "place": "Sylhet",
                    "image": "https://example.com/sylhet.jpg",
                }]
            return []

        mock_fetch.side_effect = fetch_side_effect

        res = client.get("/api/me/footprint", headers=TRAVELER_HEADERS)
        assert res.status_code == 200
        data = res.json()
        expected_keys = {"districtsVisited", "districtsTotal", "travelDays", "visitedDistricts", "timeline"}
        assert expected_keys.issubset(set(data.keys()))
        assert data["districtsTotal"] == 64


# ---------------------------------------------------------------------------
# 11. TOURS ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_tours_router(client: TestClient):
    """Verify GET /api/tours returns list of published tour packages."""
    tour_row = {
        "id": uuid.uuid4(),
        "planner_id": PLANNER_ID,
        "destination_id": DEST_ID,
        "title": "Wild Chittagong Hill Tracts Traverse",
        "price": 18500,
        "capacity": 8,
        "status": "PUBLISHED",
        "destination_name": "Bandarban",
        "planner_name": "Nadia Tour Guide",
        "departures_count": 2,
    }
    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = [tour_row]
        res = client.get("/api/tours")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "planner_id", "destination_id", "title", "price", "capacity", "status", "destination_name", "planner_name", "departures_count"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 12. COMMUNITY ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_community_router(client: TestClient):
    """Verify GET /api/community/posts returns feed items with likes and comments counts."""
    post_row = {
        "id": uuid.uuid4(),
        "author_id": TRAVELER_ID,
        "author_name": "Rafi Ahmed",
        "title": "Best tea stalls in Sreemangal",
        "body": "Nilkantha cabin is classic, but have you tried Baikka Beel tea?",
        "likes_count": 12,
        "comments_count": 4,
        "created_at": datetime.now(timezone.utc),
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER
        mock_fetch.return_value = [post_row]

        res = client.get("/api/community/posts", headers=TRAVELER_HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        expected_keys = {"id", "author_id", "author_name", "title", "body", "likes_count", "comments_count", "created_at"}
        assert expected_keys.issubset(set(data[0].keys()))


# ---------------------------------------------------------------------------
# 13. AI ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_ai_router(client: TestClient):
    """Verify POST /api/ai/conversations/{id}/messages returns synthesized message shape."""
    user_msg_row = {
        "id": uuid.uuid4(),
        "conversation_id": CONVO_ID,
        "sender": "USER",
        "body": "What to do in Sylhet?",
        "created_at": datetime.now(timezone.utc),
    }
    ai_msg_row = {
        "id": uuid.uuid4(),
        "conversation_id": CONVO_ID,
        "sender": "ASSISTANT",
        "body": "For Sylhet, visit Ratargul Swamp Forest and Jaflong.",
        "created_at": datetime.now(timezone.utc),
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock):

        def fetchrow_side_effect(query, *args):
            if "FROM ai_conversations WHERE id = $1" in query:
                return {"id": CONVO_ID, "user_id": TRAVELER_ID}
            if "INSERT INTO ai_messages" in query and "'USER'" in query:
                return user_msg_row
            if "INSERT INTO ai_messages" in query and "'ASSISTANT'" in query:
                return ai_msg_row
            if "FROM users" in query:
                return MOCK_USER
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        mock_fetch.return_value = []

        res = client.post(
            f"/api/ai/conversations/{CONVO_ID}/messages",
            json={"body": "What to do in Sylhet?"},
            headers=TRAVELER_HEADERS,
        )
        assert res.status_code == 201
        data = res.json()
        expected_keys = {"userMessage", "assistantMessage"}
        assert expected_keys.issubset(set(data.keys()))
        assert {"id", "conversation_id", "sender", "body"}.issubset(set(data["assistantMessage"].keys()))


# ---------------------------------------------------------------------------
# 14. ADMIN ROUTER CONTRACT
# ---------------------------------------------------------------------------
def test_contract_admin_router(client: TestClient):
    """Verify GET /api/admin/analytics returns complete platform analytics metrics."""
    analytics_row = {
        "users": 42,
        "planners": 6,
        "trips": 89,
        "active_groups": 14,
        "published_tours": 12,
        "reports": 3,
        "pending_verifications": 2,
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "pending_verifications" in query or "count(*)::int FROM users" in query:
                return analytics_row
            if "FROM users" in query:
                return MOCK_ADMIN
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        res = client.get("/api/admin/analytics", headers=ADMIN_HEADERS)
        assert res.status_code == 200
        data = res.json()
        expected_keys = {"users", "planners", "trips", "active_groups", "published_tours", "reports", "pending_verifications"}
        assert expected_keys.issubset(set(data.keys()))
