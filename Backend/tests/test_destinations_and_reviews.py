from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


# Sample destinations mimicking seed data
SAMPLE_DESTINATIONS = [
    {
        "id": uuid.UUID("11111111-1111-1111-1111-111111111111"),
        "name": "Sajek Valley",
        "division": "Chattogram Division",
        "district": "Rangamati",
        "description": "Kingdom of clouds nestled amidst lush verdant hill ranges.",
        "category": "Hill Station",
        "estimated_budget": 8500,
        "image": "https://images.unsplash.com/photo-sajek.jpg",
        "rating": 4.9,
        "review_count": 12,
    },
    {
        "id": uuid.UUID("22222222-2222-2222-2222-222222222222"),
        "name": "Ratargul Swamp Forest",
        "division": "Sylhet Division",
        "district": "Sylhet",
        "description": "Evergreen freshwater swamp forest submerged in crystal water.",
        "category": "Nature",
        "estimated_budget": 6500,
        "image": "https://images.unsplash.com/photo-ratargul.jpg",
        "rating": 4.8,
        "review_count": 8,
    },
    {
        "id": uuid.UUID("33333333-3333-3333-3333-333333333333"),
        "name": "Saint Martin's Island",
        "division": "Chattogram Division",
        "district": "Cox's Bazar",
        "description": "Small coral island with azure sea waters and swaying coconut palms.",
        "category": "Island",
        "estimated_budget": 11000,
        "image": "https://images.unsplash.com/photo-saint-martin.jpg",
        "rating": 4.9,
        "review_count": 25,
    },
]


# ---------------------------------------------------------------------------
# 1. SEARCH AND CATEGORY FILTERING
# ---------------------------------------------------------------------------
def test_search_and_category_filtering(client: TestClient):
    """
    CHECKLIST TEST:
    Search and category filter return the expected destinations matching legacy queries.
    """
    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        # Mock search by q='sajek'
        mock_fetch.return_value = [SAMPLE_DESTINATIONS[0]]
        res = client.get("/api/destinations?q=sajek")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["name"] == "Sajek Valley"
        assert items[0]["estimatedBudget"] == 8500

        # Verify query parameters passed to db.fetch
        mock_fetch.assert_awaited_with(
            mock_fetch.call_args[0][0],
            "%sajek%",
            None,
        )

        # Mock category filter='Nature'
        mock_fetch.return_value = [SAMPLE_DESTINATIONS[1]]
        res_cat = client.get("/api/destinations?category=Nature")
        assert res_cat.status_code == 200
        items_cat = res_cat.json()
        assert len(items_cat) == 1
        assert items_cat[0]["name"] == "Ratargul Swamp Forest"


def test_destination_detail_returns_dossier_and_reviews(client: TestClient):
    """Destination detail endpoint returns single destination with reviews array."""
    dest = SAMPLE_DESTINATIONS[0]
    dest_id = dest["id"]

    sample_reviews = [
        {
            "id": uuid.uuid4(),
            "destination_id": dest_id,
            "author_id": uuid.uuid4(),
            "author_name": "Rafi Ahmed",
            "author_avatar": "https://example.com/rafi.jpg",
            "rating": 5,
            "body": "Watching the clouds float by at Konglak Para was majestic!",
            "created_at": "2025-05-18T10:00:00Z",
        }
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = dest
        mock_fetch.return_value = sample_reviews

        res = client.get(f"/api/destinations/{dest_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == str(dest_id)
        assert data["name"] == "Sajek Valley"
        assert "reviews" in data
        assert len(data["reviews"]) == 1
        assert data["reviews"][0]["author_name"] == "Rafi Ahmed"


def test_destination_detail_not_found(client: TestClient):
    """Non-existent destination returns 404 'Destination not found'."""
    random_id = uuid.uuid4()
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = None
        res = client.get(f"/api/destinations/{random_id}")
        assert res.status_code == 404
        assert res.json() == {"error": "Destination not found"}


# ---------------------------------------------------------------------------
# 2. ADMIN-ONLY CRUD IS BLOCKED FOR OTHER ROLES
# ---------------------------------------------------------------------------
def test_admin_only_crud_blocked_for_traveler_and_planner(client: TestClient):
    """
    CHECKLIST TEST:
    Admin-only CRUD is blocked for other roles.
    - POST /api/destinations: requires ADMIN
    - PUT /api/destinations/{id}: requires ADMIN
    - DELETE /api/destinations/{id}: requires ADMIN
    """
    traveler_id = uuid.uuid4()
    traveler_token = create_access_token({"id": str(traveler_id), "role": "TRAVELER"})
    traveler_user = {
        "id": traveler_id,
        "name": "Rafi Traveler",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
    }

    planner_id = uuid.uuid4()
    planner_token = create_access_token({"id": str(planner_id), "role": "TOUR_PLANNER"})
    planner_user = {
        "id": planner_id,
        "name": "Nadia Planner",
        "email": "planner@porikroma.com",
        "role": "TOUR_PLANNER",
        "status": "ACTIVE",
    }

    dest_payload = {
        "name": "Tanguar Haor",
        "division": "Sylhet Division",
        "district": "Sunamganj",
        "description": "Unique wetland ecosystem in northeastern Bangladesh with pristine waters.",
        "category": "Wetland",
        "estimatedBudget": 9000,
        "image": "https://images.unsplash.com/photo-tanguar.jpg",
    }
    dummy_dest_id = uuid.uuid4()

    # 1. TRAVELER attempted mutations -> all 403 "Admin role required"
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = traveler_user

        # Create
        res_create = client.post(
            "/api/destinations",
            headers={"Authorization": f"Bearer {traveler_token}"},
            json=dest_payload,
        )
        assert res_create.status_code == 403
        assert res_create.json() == {"error": "Admin role required"}

        # Update
        res_update = client.put(
            f"/api/destinations/{dummy_dest_id}",
            headers={"Authorization": f"Bearer {traveler_token}"},
            json=dest_payload,
        )
        assert res_update.status_code == 403
        assert res_update.json() == {"error": "Admin role required"}

        # Delete
        res_delete = client.delete(
            f"/api/destinations/{dummy_dest_id}",
            headers={"Authorization": f"Bearer {traveler_token}"},
        )
        assert res_delete.status_code == 403
        assert res_delete.json() == {"error": "Admin role required"}

    # 2. TOUR_PLANNER attempted mutations -> all 403 "Admin role required"
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = planner_user

        res_create_p = client.post(
            "/api/destinations",
            headers={"Authorization": f"Bearer {planner_token}"},
            json=dest_payload,
        )
        assert res_create_p.status_code == 403
        assert res_create_p.json() == {"error": "Admin role required"}

        res_update_p = client.put(
            f"/api/destinations/{dummy_dest_id}",
            headers={"Authorization": f"Bearer {planner_token}"},
            json=dest_payload,
        )
        assert res_update_p.status_code == 403
        assert res_update_p.json() == {"error": "Admin role required"}

        res_delete_p = client.delete(
            f"/api/destinations/{dummy_dest_id}",
            headers={"Authorization": f"Bearer {planner_token}"},
        )
        assert res_delete_p.status_code == 403
        assert res_delete_p.json() == {"error": "Admin role required"}


def test_admin_crud_destinations_success(client: TestClient):
    """Admin user can successfully create, update, and delete destinations."""
    admin_id = uuid.uuid4()
    admin_token = create_access_token({"id": str(admin_id), "role": "ADMIN"})
    admin_user = {
        "id": admin_id,
        "name": "Platform Admin",
        "email": "admin@porikroma.com",
        "role": "ADMIN",
        "status": "ACTIVE",
    }

    dest_id = uuid.uuid4()
    created_dest = {
        "id": dest_id,
        "name": "Bichnakandi",
        "division": "Sylhet Division",
        "district": "Sylhet",
        "description": "Quarry of river stones surrounded by high mountain ranges.",
        "category": "River",
        "estimated_budget": 5500,
        "image": "https://images.unsplash.com/bichnakandi.jpg",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # 1. CREATE
        mock_fetchrow.side_effect = [
            admin_user,   # auth lookup
            created_dest, # insert returning row
        ]
        res_create = client.post(
            "/api/destinations",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "Bichnakandi",
                "division": "Sylhet Division",
                "district": "Sylhet",
                "description": "Quarry of river stones surrounded by high mountain ranges.",
                "category": "River",
                "estimatedBudget": 5500,
                "image": "https://images.unsplash.com/bichnakandi.jpg",
            },
        )
        assert res_create.status_code == 201
        assert res_create.json()["name"] == "Bichnakandi"
        assert res_create.json()["estimatedBudget"] == 5500

        # 2. UPDATE
        updated_dest = {**created_dest, "name": "Bichnakandi Serene"}
        mock_fetchrow.side_effect = [
            admin_user,   # auth lookup
            updated_dest, # update returning row
        ]
        res_update = client.put(
            f"/api/destinations/{dest_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "Bichnakandi Serene",
                "division": "Sylhet Division",
                "district": "Sylhet",
                "description": "Quarry of river stones surrounded by high mountain ranges.",
                "category": "River",
                "estimatedBudget": 6000,
            },
        )
        assert res_update.status_code == 200
        assert res_update.json()["name"] == "Bichnakandi Serene"

        # 3. DELETE
        mock_fetchrow.side_effect = [admin_user]
        mock_execute.return_value = "DELETE 1"
        res_delete = client.delete(
            f"/api/destinations/{dest_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_delete.status_code == 200
        assert res_delete.json() == {"success": True}


# ---------------------------------------------------------------------------
# 3. REVIEWS ATTACH TO DESTINATION AND USER
# ---------------------------------------------------------------------------
def test_reviews_attach_to_destination_and_user(client: TestClient):
    """
    CHECKLIST TEST:
    Reviews attach to the correct destination and user.
    """
    user_id = uuid.uuid4()
    dest_id = uuid.uuid4()
    review_id = uuid.uuid4()
    user_token = create_access_token({"id": str(user_id), "role": "TRAVELER"})

    user_record = {
        "id": user_id,
        "name": "Samira Rahman",
        "email": "traveler2@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
    }

    created_review = {
        "id": review_id,
        "destination_id": dest_id,
        "author_id": user_id,
        "rating": 5,
        "body": "The night sky at Saint Martin island was full of stars!",
        "created_at": "2025-06-12T14:00:00Z",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        # 1. Submit review
        mock_fetchrow.side_effect = [
            user_record,    # auth lookup
            created_review, # insert returning review
        ]

        res = client.post(
            "/api/reviews",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "destinationId": str(dest_id),
                "rating": 5,
                "body": "The night sky at Saint Martin island was full of stars!",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == str(review_id)
        assert data["destination_id"] == str(dest_id)
        assert data["author_id"] == str(user_id)
        assert data["rating"] == 5

        # 2. List reviews per destination
        mock_fetch.return_value = [
            {**created_review, "author_name": "Samira Rahman"}
        ]
        res_list = client.get(f"/api/destinations/{dest_id}/reviews")
        assert res_list.status_code == 200
        reviews_data = res_list.json()
        assert len(reviews_data) == 1
        assert reviews_data[0]["destination_id"] == str(dest_id)
        assert reviews_data[0]["author_name"] == "Samira Rahman"


def test_review_validation_rules(client: TestClient):
    """Review rating must be between 1 and 5, body at least 2 chars."""
    user_id = uuid.uuid4()
    user_token = create_access_token({"id": str(user_id), "role": "TRAVELER"})
    user_record = {
        "id": user_id,
        "name": "Rafi Ahmed",
        "email": "traveler@porikroma.com",
        "role": "TRAVELER",
        "status": "ACTIVE",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = user_record

        # Rating 6 is invalid -> 400
        res_bad_rating = client.post(
            "/api/reviews",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"destinationId": str(uuid.uuid4()), "rating": 6, "body": "Great!"},
        )
        assert res_bad_rating.status_code == 400
        assert res_bad_rating.json()["error"] == "Validation failed"

        # Rating 0 is invalid -> 400
        res_zero_rating = client.post(
            "/api/reviews",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"destinationId": str(uuid.uuid4()), "rating": 0, "body": "Bad!"},
        )
        assert res_zero_rating.status_code == 400
        assert res_zero_rating.json()["error"] == "Validation failed"
