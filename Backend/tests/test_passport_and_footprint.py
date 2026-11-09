from datetime import date
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEST_1_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
DEST_2_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
DEST_3_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
ENTRY_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")

MOCK_USER = {
    "id": USER_ID,
    "email": "traveler@porikroma.com",
    "name": "Rafi Ahmed",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

AUTH_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(USER_ID), 'email': 'traveler@porikroma.com', 'role': 'TRAVELER'})}"
}


# ---------------------------------------------------------------------------
# 1. 64-DISTRICT FOOTPRINT METRICS & PROGRESS
# ---------------------------------------------------------------------------
def test_get_my_footprint_returns_64_district_stats(client: TestClient):
    """
    CHECKLIST TEST:
    Verifies 64-district progress data, visited districts list, and trip timeline.
    """
    mock_districts = [
        {"district": "Cox's Bazar"},
        {"district": "Sylhet"},
        {"district": "Bandarban"},
        {"district": "Rangamati"},
    ]
    mock_trips = [
        {
            "id": uuid.uuid4(),
            "name": "Monsoon Clouds Expedition",
            "start_date": date(2025, 7, 10),
            "end_date": date(2025, 7, 14),
            "status": "COMPLETED",
            "place": "Sajek Valley",
            "image": "https://images.unsplash.com/photo-sajek.jpg",
        }
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        mock_fetchrow.return_value = MOCK_USER
        # First call fetches districts, second call fetches trips
        mock_fetch.side_effect = [mock_districts, mock_trips]

        res = client.get("/api/me/footprint", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.json()

        assert data["districtsVisited"] == 4
        assert data["districtsTotal"] == 64
        assert data["countriesVisited"] == 2
        assert data["countriesTotal"] == 195
        assert data["travelDays"] == 5  # (14 - 10) + 1 = 5
        assert len(data["visitedDistricts"]) == 4
        assert "Cox's Bazar" in data["visitedDistricts"]
        assert len(data["timeline"]) == 1
        assert data["timeline"][0]["title"] == "Monsoon Clouds Expedition"
        assert data["timeline"][0]["place"] == "Sajek Valley"


# ---------------------------------------------------------------------------
# 2. PASSPORT STAMPS CRUD & ACHIEVEMENTS TRIGGER
# ---------------------------------------------------------------------------
def test_list_my_passport_stamps(client: TestClient):
    """Verifies retrieval of official passport stamps."""
    mock_stamps = [
        {
            "id": ENTRY_ID,
            "user_id": USER_ID,
            "destination_id": DEST_1_ID,
            "visited_on": date(2024, 10, 15),
            "visibility": "PUBLIC",
            "created_at": "2024-10-15T12:00:00Z",
            "destination_name": "Cox's Bazar Beach",
            "district": "Cox's Bazar",
            "division": "Chattogram Division",
            "image": "https://images.unsplash.com/photo-cox.jpg",
        }
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        mock_fetchrow.return_value = MOCK_USER
        mock_fetch.return_value = mock_stamps

        res = client.get("/api/me/passport", headers=AUTH_HEADERS)
        assert res.status_code == 200
        stamps = res.json()
        assert len(stamps) == 1
        assert stamps[0]["destination_name"] == "Cox's Bazar Beach"
        assert stamps[0]["district"] == "Cox's Bazar"
        assert stamps[0]["visited_on"] == "2024-10-15"


def test_add_passport_stamp_updates_district_progress_and_awards_badges(client: TestClient):
    """
    CHECKLIST TEST:
    Adding a visited destination updates district progress and badges.
    """
    created_stamp = {
        "id": ENTRY_ID,
        "user_id": USER_ID,
        "destination_id": DEST_1_ID,
        "visited_on": date(2025, 1, 1),
        "visibility": "PUBLIC",
        "created_at": "2025-01-01T10:00:00Z",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER
            if "FROM destinations" in query:
                return {"id": DEST_1_ID}
            if "INSERT INTO passport_entries" in query:
                return created_stamp
            if "SELECT count(*)::int AS total_stamps" in query:
                # 5 distinct districts and 5 stamps -> triggers FIRST_DESTINATION and FIVE_DISTRICTS
                return {"total_stamps": 5, "total_districts": 5}
            if "SELECT 1 FROM group_members" in query:
                return {"1": 1}
            if "SELECT 1 FROM trip_notes" in query:
                return None
            if "SELECT 1 FROM trips" in query:
                return None
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        payload = {
            "destinationId": str(DEST_1_ID),
            "visitedOn": "2025-01-01",
            "visibility": "PUBLIC",
        }
        res = client.post("/api/me/passport", json=payload, headers=AUTH_HEADERS)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == str(ENTRY_ID)
        assert data["destination_id"] == str(DEST_1_ID)

        # Verify badges evaluation inserted into user_achievements
        exec_calls = [call[0][0] for call in mock_exec.call_args_list]
        ach_insert_calls = [c for c in exec_calls if "INSERT INTO user_achievements" in c]
        assert len(ach_insert_calls) >= 3  # FIRST_DESTINATION, FIVE_DISTRICTS, GROUP_EXPEDITION


def test_add_passport_stamp_not_found(client: TestClient):
    """Adding stamp for non-existent destination returns 404."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER
            if "FROM destinations" in query:
                return None
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.post(
            "/api/me/passport",
            json={"destinationId": str(DEST_1_ID)},
            headers=AUTH_HEADERS,
        )
        assert res.status_code == 404
        assert res.json()["error"] == "Destination not found"


def test_delete_passport_stamp(client: TestClient):
    """Deleting a stamp removes entry."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        mock_fetchrow.return_value = MOCK_USER

        res = client.delete(f"/api/me/passport/{ENTRY_ID}", headers=AUTH_HEADERS)
        assert res.status_code == 200
        assert res.json() == {"success": True}
        mock_exec.assert_awaited_once()


def test_delete_passport_stamp_invalid_id(client: TestClient):
    """Deleting stamp with malformed UUID returns 400."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = MOCK_USER
        res = client.delete("/api/me/passport/not-a-valid-uuid", headers=AUTH_HEADERS)
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# 3. MILESTONE ACHIEVEMENTS
# ---------------------------------------------------------------------------
def test_list_my_achievements_with_unlocked_status(client: TestClient):
    """Listing achievements dynamically reflects unlock criteria."""
    mock_achievements = [
        {
            "id": uuid.uuid4(),
            "code": "FIRST_DESTINATION",
            "title": "First Destination",
            "description": "Began your journey.",
            "unlocked": True,
            "unlocked_at": "2024-10-15T12:00:00Z",
        },
        {
            "id": uuid.uuid4(),
            "code": "FIVE_DISTRICTS",
            "title": "District Explorer",
            "description": "Explored 5 districts.",
            "unlocked": False,
            "unlocked_at": None,
        },
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER
            if "SELECT count(*)::int AS total_stamps" in query:
                return {"total_stamps": 1, "total_districts": 1}
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        mock_fetch.return_value = mock_achievements

        res = client.get("/api/me/achievements", headers=AUTH_HEADERS)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 2
        assert items[0]["code"] == "FIRST_DESTINATION"
        assert items[0]["unlocked"] is True
        assert items[1]["code"] == "FIVE_DISTRICTS"
        assert items[1]["unlocked"] is False


# ---------------------------------------------------------------------------
# 4. WISHLIST MANAGEMENT
# ---------------------------------------------------------------------------
def test_wishlist_toggle_and_list(client: TestClient):
    """Toggle destination into wishlist, then untoggle."""
    dest_row = {
        "id": DEST_1_ID,
        "name": "Ratargul Swamp Forest",
        "district": "Sylhet",
        "category": "Nature",
        "estimated_budget": 6500,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        # 1. Toggle ON
        def toggle_on_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER
            if "SELECT id FROM destinations" in query:
                return {"id": DEST_1_ID}
            if "SELECT 1 FROM wishlist_destinations" in query:
                return None  # not wishlisted yet
            return None

        mock_fetchrow.side_effect = toggle_on_side_effect
        res_on = client.post(f"/api/me/wishlist/{DEST_1_ID}", headers=AUTH_HEADERS)
        assert res_on.status_code == 200
        assert res_on.json() == {"wishlisted": True}

        # 2. List wishlist
        mock_fetch.return_value = [dest_row]
        res_list = client.get("/api/me/wishlist", headers=AUTH_HEADERS)
        assert res_list.status_code == 200
        items = res_list.json()
        assert len(items) == 1
        assert items[0]["id"] == str(DEST_1_ID)
        assert items[0]["name"] == "Ratargul Swamp Forest"

        # 3. Toggle OFF
        def toggle_off_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER
            if "SELECT id FROM destinations" in query:
                return {"id": DEST_1_ID}
            if "SELECT 1 FROM wishlist_destinations" in query:
                return {"1": 1}  # already wishlisted
            return None

        mock_fetchrow.side_effect = toggle_off_side_effect
        res_off = client.post(f"/api/me/wishlist/{DEST_1_ID}", headers=AUTH_HEADERS)
        assert res_off.status_code == 200
        assert res_off.json() == {"wishlisted": False}


def test_wishlist_destination_not_found(client: TestClient):
    """Toggling non-existent destination returns 404."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER
            if "SELECT id FROM destinations" in query:
                return None
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        res = client.post(f"/api/me/wishlist/{DEST_1_ID}", headers=AUTH_HEADERS)
        assert res.status_code == 404
        assert res.json()["error"] == "Destination not found"
