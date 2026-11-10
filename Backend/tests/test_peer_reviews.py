from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import Database, db
from app.services.security import create_access_token

USER_A_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_B_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
USER_C_ID = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
ADMIN_ID = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
TRIP_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")

USER_A = {
    "id": USER_A_ID,
    "email": "travelerA@porikroma.com",
    "name": "Traveler A",
    "role": "TRAVELER",
    "status": "ACTIVE",
}

USER_B = {
    "id": USER_B_ID,
    "email": "travelerB@porikroma.com",
    "name": "Traveler B",
    "role": "TRAVELER",
    "status": "ACTIVE",
}

ADMIN_USER = {
    "id": ADMIN_ID,
    "email": "admin@porikroma.com",
    "name": "Admin User",
    "role": "ADMIN",
    "status": "ACTIVE",
}

AUTH_A = {"Authorization": f"Bearer {create_access_token({'sub': str(USER_A_ID), 'email': 'travelerA@porikroma.com', 'role': 'TRAVELER'})}"}
AUTH_B = {"Authorization": f"Bearer {create_access_token({'sub': str(USER_B_ID), 'email': 'travelerB@porikroma.com', 'role': 'TRAVELER'})}"}
AUTH_ADMIN = {"Authorization": f"Bearer {create_access_token({'sub': str(ADMIN_ID), 'email': 'admin@porikroma.com', 'role': 'ADMIN'})}"}


# ---------------------------------------------------------------------------
# 1. RULE VIOLATIONS & VALIDATION ERRORS
# ---------------------------------------------------------------------------

def test_self_review_rejected(client: TestClient):
    """Traveler cannot review themselves."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = USER_A

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_A_ID),
                "rating": 5,
                "comment": "Great trip!",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 400
        assert res.json()["error"] == "You cannot review yourself"


def test_rating_boundaries_enforced(client: TestClient):
    """Rating must be between 1 and 5."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = USER_A

        # Rating 0 (too low)
        res_low = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 0,
                "comment": "Bad",
            },
            headers=AUTH_A,
        )
        assert res_low.status_code == 400
        assert res_low.json()["error"] == "Rating must be between 1 and 5"

        # Rating 6 (too high)
        res_high = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 6,
                "comment": "Too good",
            },
            headers=AUTH_A,
        )
        assert res_high.status_code == 400
        assert res_high.json()["error"] == "Rating must be between 1 and 5"


def test_trip_not_found(client: TestClient):
    """Non-existent trip returns 404."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "FROM trips WHERE id = $1" in query:
                return None
            return None

        mock_fetchrow.side_effect = side_effect

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 5,
                "comment": "Nice mate",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 404
        assert res.json()["error"] == "Trip not found"


def test_review_before_trip_completion_rejected(client: TestClient):
    """Reviews can only be submitted after the trip is completed."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "FROM trips WHERE id = $1" in query:
                return {"id": TRIP_ID, "name": "Bandarban Trek", "status": "PLANNING", "creator_id": USER_A_ID}
            return None

        mock_fetchrow.side_effect = side_effect

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 5,
                "comment": "Fun times!",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 400
        assert "completed" in res.json()["error"].lower()


def test_non_member_reviewer_rejected(client: TestClient):
    """Reviewer must be an approved member of the trip."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "SELECT id, name, status, creator_id FROM trips" in query:
                return {"id": TRIP_ID, "name": "Bandarban Trek", "status": "COMPLETED", "creator_id": USER_C_ID}
            if "UNION" in query:
                # user A is not a member
                return None
            return None

        mock_fetchrow.side_effect = side_effect

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 5,
                "comment": "Fun times!",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 403
        assert "member" in res.json()["error"].lower()


def test_non_member_reviewee_rejected(client: TestClient):
    """Reviewee must also be a member of the trip."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "SELECT id, name, status, creator_id FROM trips" in query:
                return {"id": TRIP_ID, "name": "Bandarban Trek", "status": "COMPLETED", "creator_id": USER_A_ID}
            if "UNION" in query:
                # args[1] is user_id
                if args[1] == USER_A_ID:
                    return {"?column?": 1}
                if args[1] == USER_B_ID:
                    return None  # reviewee not in trip
            return None

        mock_fetchrow.side_effect = side_effect

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 5,
                "comment": "Fun times!",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 400
        assert "not a member" in res.json()["error"].lower()


def test_duplicate_review_rejected(client: TestClient):
    """Cannot review the same traveler twice for the same trip."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "FROM trips WHERE id = $1" in query:
                return {"id": TRIP_ID, "name": "Bandarban Trek", "status": "COMPLETED", "creator_id": USER_A_ID}
            if "UNION" in query:
                return {"?column?": 1}  # both members
            if "FROM peer_reviews WHERE trip_id = $1" in query:
                return {"id": uuid.uuid4()}  # already exists
            return None

        mock_fetchrow.side_effect = side_effect

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 5,
                "comment": "Second review attempt",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 400
        assert "already reviewed" in res.json()["error"].lower()


# ---------------------------------------------------------------------------
# 2. SUCCESSFUL REVIEW CREATION & NOTIFICATION
# ---------------------------------------------------------------------------

def test_successful_peer_review_creation(client: TestClient):
    """Approved trip member successfully reviews a companion after trip completion."""
    review_id = uuid.uuid4()
    created_row = {
        "id": review_id,
        "trip_id": TRIP_ID,
        "reviewer_id": USER_A_ID,
        "reviewee_id": USER_B_ID,
        "rating": 5,
        "comment": "Outstanding teammate, reliable and respectful!",
        "created_at": datetime.now(timezone.utc),
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        def side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "FROM trips WHERE id = $1" in query:
                return {"id": TRIP_ID, "name": "Sajek Valley Expedition", "status": "COMPLETED", "creator_id": USER_A_ID}
            if "UNION" in query:
                return {"?column?": 1}
            if "FROM peer_reviews WHERE trip_id = $1" in query:
                return None
            if "INSERT INTO peer_reviews" in query:
                return created_row
            return None

        mock_fetchrow.side_effect = side_effect
        mock_execute.return_value = "INSERT 0 1"

        res = client.post(
            "/api/peer-reviews",
            json={
                "tripId": str(TRIP_ID),
                "revieweeId": str(USER_B_ID),
                "rating": 5,
                "comment": "Outstanding teammate, reliable and respectful!",
            },
            headers=AUTH_A,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["rating"] == 5
        assert data["comment"] == "Outstanding teammate, reliable and respectful!"
        # Check notification was inserted
        assert mock_execute.await_count >= 1


# ---------------------------------------------------------------------------
# 3. AVERAGE RATING DISPLAY & REVIEW LISTING
# ---------------------------------------------------------------------------

def test_average_rating_display_and_reviews_list(client: TestClient):
    """Average rating and count are accurately calculated from received peer reviews."""
    review1 = {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "reviewer_id": USER_A_ID,
        "reviewee_id": USER_B_ID,
        "rating": 5,
        "comment": "Super organized and fun!",
        "created_at": datetime.now(timezone.utc),
        "reviewer_name": "Traveler A",
        "reviewer_avatar": "",
        "trip_name": "Sajek Valley Expedition",
    }
    review2 = {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "reviewer_id": USER_C_ID,
        "reviewee_id": USER_B_ID,
        "rating": 4,
        "comment": "Helpful in camp setup.",
        "created_at": datetime.now(timezone.utc),
        "reviewer_name": "Traveler C",
        "reviewer_avatar": "",
        "trip_name": "Sajek Valley Expedition",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        def fetchrow_side_effect(query, *args):
            if "FROM users WHERE id = $1" in query and "name, email" in query:
                return USER_A
            if "FROM users WHERE id = $1" in query:
                # target user lookup
                return USER_B
            if "FROM user_privacy_settings" in query:
                return {"profile_visibility": "PUBLIC", "reviews_visibility": "PUBLIC"}
            return USER_A

        mock_fetchrow.side_effect = fetchrow_side_effect
        mock_fetch.return_value = [review1, review2]

        res = client.get(f"/api/users/{USER_B_ID}/reviews", headers=AUTH_A)
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 2
        assert data["average_rating"] == 4.5  # (5 + 4) / 2
        assert len(data["reviews"]) == 2
        assert data["privacy"] == "PUBLIC"


# ---------------------------------------------------------------------------
# 4. PRIVACY SETTINGS RESPECTED
# ---------------------------------------------------------------------------

def test_private_reviews_hidden_from_other_travelers(client: TestClient):
    """When a traveler sets reviews_visibility='PRIVATE', other users cannot see them."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        def fetchrow_side_effect(query, *args):
            if "FROM users WHERE id = $1" in query and "name, email" in query:
                return USER_A
            if "FROM users WHERE id = $1" in query:
                return USER_B
            if "FROM user_privacy_settings" in query:
                return {"profile_visibility": "PUBLIC", "reviews_visibility": "PRIVATE"}
            return USER_A

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.get(f"/api/users/{USER_B_ID}/reviews", headers=AUTH_A)
        assert res.status_code == 200
        data = res.json()
        assert data["privacy"] == "PRIVATE"
        assert data["reviews"] == []
        assert data["count"] == 0
        assert data["average_rating"] is None


def test_private_reviews_visible_to_self_and_admin(client: TestClient):
    """Traveler themselves and ADMIN can see private reviews."""
    review1 = {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "reviewer_id": USER_A_ID,
        "reviewee_id": USER_B_ID,
        "rating": 5,
        "comment": "Secret praise",
        "created_at": datetime.now(timezone.utc),
        "reviewer_name": "Traveler A",
        "reviewer_avatar": "",
        "trip_name": "Sajek Trip",
    }

    # 1. Self viewing
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = USER_B
        mock_fetch.return_value = [review1]

        res_self = client.get(f"/api/users/{USER_B_ID}/reviews", headers=AUTH_B)
        assert res_self.status_code == 200
        assert res_self.json()["count"] == 1
        assert res_self.json()["average_rating"] == 5.0

    # 2. Admin viewing
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        def admin_fetchrow(query, *args):
            if "FROM users WHERE id = $1" in query and "name, email" in query:
                return ADMIN_USER
            return USER_B

        mock_fetchrow.side_effect = admin_fetchrow
        mock_fetch.return_value = [review1]

        res_admin = client.get(f"/api/users/{USER_B_ID}/reviews", headers=AUTH_ADMIN)
        assert res_admin.status_code == 200
        assert res_admin.json()["count"] == 1
        assert res_admin.json()["average_rating"] == 5.0


# ---------------------------------------------------------------------------
# 5. PENDING PEER REVIEWS ON COMPLETED TRIP
# ---------------------------------------------------------------------------

def test_list_pending_peer_reviews_on_completed_trip(client: TestClient):
    """Returns companions who have not yet been reviewed on a completed trip."""
    companion_row = {
        "id": USER_B_ID,
        "name": "Traveler B",
        "email": "travelerB@porikroma.com",
        "avatar_url": "",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "FROM trips WHERE id = $1" in query:
                return {"id": TRIP_ID, "name": "Completed Trek", "status": "COMPLETED", "creator_id": USER_A_ID}
            if "UNION" in query:
                return {"?column?": 1}
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        mock_fetch.return_value = [companion_row]

        res = client.get(f"/api/trips/{TRIP_ID}/peer-reviews/pending", headers=AUTH_A)
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "Traveler B"


def test_list_pending_peer_reviews_returns_empty_when_not_completed(client: TestClient):
    """Pending reviews list is empty if the trip is still ongoing or in planning."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return USER_A
            if "FROM trips WHERE id = $1" in query:
                return {"id": TRIP_ID, "name": "Active Trek", "status": "ACTIVE", "creator_id": USER_A_ID}
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.get(f"/api/trips/{TRIP_ID}/peer-reviews/pending", headers=AUTH_A)
        assert res.status_code == 200
        assert res.json() == []


# ---------------------------------------------------------------------------
# 6. MIGRATION IDEMPOTENCY
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_migration_002_peer_reviews_idempotent():
    """Migration 002 runs multiple times without error."""
    migration_file = Path(__file__).resolve().parent.parent / "migrations" / "002_peer_reviews.sql"
    assert migration_file.exists(), "Migration 002_peer_reviews.sql should exist"
    sql = migration_file.read_text(encoding="utf-8")

    test_db = Database()
    mock_conn = AsyncMock()
    mock_pool = MagicMock()

    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__.return_value = mock_conn
    acquire_ctx.__aexit__.return_value = None
    mock_pool.acquire.return_value = acquire_ctx
    test_db.pool = mock_pool

    # Run 1
    async with test_db.pool.acquire() as conn:
        await conn.execute(sql)

    # Run 2 (Idempotent rerun)
    async with test_db.pool.acquire() as conn:
        await conn.execute(sql)

    assert mock_conn.execute.await_count == 2
