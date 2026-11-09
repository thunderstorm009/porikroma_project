from datetime import date
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


PLANNER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
OTHER_PLANNER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
TRAVELER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
ADMIN_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")

DEST_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")
TOUR_ID = uuid.UUID("66666666-6666-6666-6666-666666666666")
DEP_ID = uuid.UUID("77777777-7777-7777-7777-777777777777")
BOOKING_ID = uuid.UUID("88888888-8888-8888-8888-888888888888")

MOCK_PLANNER = {
    "id": PLANNER_ID,
    "email": "planner@porikroma.com",
    "name": "Nadia Tour Guide",
    "role": "TOUR_PLANNER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_OTHER_PLANNER = {
    "id": OTHER_PLANNER_ID,
    "email": "otherplanner@porikroma.com",
    "name": "Kamal Guide",
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

MOCK_ADMIN = {
    "id": ADMIN_ID,
    "email": "admin@porikroma.com",
    "name": "Admin User",
    "role": "ADMIN",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

PLANNER_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(PLANNER_ID), 'email': 'planner@porikroma.com', 'role': 'TOUR_PLANNER'})}"
}

OTHER_PLANNER_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(OTHER_PLANNER_ID), 'email': 'otherplanner@porikroma.com', 'role': 'TOUR_PLANNER'})}"
}

TRAVELER_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(TRAVELER_ID), 'email': 'traveler@porikroma.com', 'role': 'TRAVELER'})}"
}

ADMIN_HEADERS = {
    "Authorization": f"Bearer {create_access_token({'sub': str(ADMIN_ID), 'email': 'admin@porikroma.com', 'role': 'ADMIN'})}"
}


# ---------------------------------------------------------------------------
# 1. SEAT AVAILABILITY AND BOOKING CREATION
# ---------------------------------------------------------------------------
def test_booking_cannot_exceed_available_seats(client: TestClient):
    """
    CHECKLIST TEST:
    Booking cannot exceed available seats.
    """
    departure_row = {
        "id": DEP_ID,
        "tour_id": TOUR_ID,
        "start_date": date(2025, 6, 12),
        "end_date": date(2025, 6, 15),
        "capacity": 10,
        "status": "OPEN",
        "planner_id": PLANNER_ID,
        "tour_title": "Sylhet Tea Country Expedition",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_TRAVELER
            if "FROM tour_departures" in query:
                return departure_row
            if "SELECT coalesce(sum(travelers_count)" in query:
                # 8 seats already booked out of 10 -> only 2 available
                return {"booked_count": 8}
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        # Attempt to book 3 seats (exceeds available 2)
        res = client.post(
            f"/api/departures/{DEP_ID}/bookings",
            json={"travelersCount": 3},
            headers=TRAVELER_HEADERS,
        )
        assert res.status_code == 400
        assert "exceed" in res.json()["error"].lower() or "seats" in res.json()["error"].lower()


def test_booking_succeeds_when_seats_available(client: TestClient):
    """Traveler successfully books when seats are available."""
    departure_row = {
        "id": DEP_ID,
        "tour_id": TOUR_ID,
        "start_date": date(2025, 6, 12),
        "end_date": date(2025, 6, 15),
        "capacity": 10,
        "status": "OPEN",
        "planner_id": PLANNER_ID,
        "tour_title": "Sylhet Tea Country Expedition",
    }

    created_booking = {
        "id": BOOKING_ID,
        "departure_id": DEP_ID,
        "traveler_id": TRAVELER_ID,
        "travelers_count": 2,
        "status": "PENDING",
        "created_at": "2025-06-01T10:00:00Z",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_TRAVELER
            if "FROM tour_departures" in query:
                return departure_row
            if "SELECT coalesce(sum(travelers_count)" in query:
                # 4 booked -> 6 available
                return {"booked_count": 4}
            if "INSERT INTO bookings" in query:
                return created_booking
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.post(
            f"/api/departures/{DEP_ID}/bookings",
            json={"travelersCount": 2},
            headers=TRAVELER_HEADERS,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == str(BOOKING_ID)
        assert data["travelers_count"] == 2
        assert data["status"] == "PENDING"


def test_booking_rejected_when_departure_cancelled(client: TestClient):
    """Booking cannot be made for cancelled departure."""
    departure_row = {
        "id": DEP_ID,
        "tour_id": TOUR_ID,
        "start_date": date(2025, 6, 12),
        "end_date": date(2025, 6, 15),
        "capacity": 10,
        "status": "CANCELLED",
        "planner_id": PLANNER_ID,
        "tour_title": "Sylhet Tea Country Expedition",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_TRAVELER
            if "FROM tour_departures" in query:
                return departure_row
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.post(
            f"/api/departures/{DEP_ID}/bookings",
            json={"travelersCount": 1},
            headers=TRAVELER_HEADERS,
        )
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# 2. PLANNER CONFIRMATION / CANCELLATION PERMISSIONS
# ---------------------------------------------------------------------------
def test_only_owning_planner_can_confirm_or_cancel_bookings(client: TestClient):
    """
    CHECKLIST TEST:
    Only the owning planner can confirm or cancel bookings for their tours.
    """
    booking_row = {
        "id": BOOKING_ID,
        "departure_id": DEP_ID,
        "traveler_id": TRAVELER_ID,
        "travelers_count": 2,
        "status": "PENDING",
        "capacity": 10,
        "dep_id": DEP_ID,
        "planner_id": PLANNER_ID,
        "tour_title": "Sylhet Tea Country Expedition",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(current_user_obj):
            def side_effect(query, *args):
                if "FROM users" in query:
                    return current_user_obj
                if "FROM bookings b" in query:
                    return booking_row
                if "SELECT coalesce(sum(travelers_count)" in query:
                    return {"confirmed_count": 0}
                if "UPDATE bookings" in query:
                    return {**booking_row, "status": "CONFIRMED"}
                return None
            return side_effect

        # 1. Traveler attempts status change -> 403 Forbidden
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_TRAVELER)
        res_trav = client.patch(
            f"/api/bookings/{BOOKING_ID}/status",
            json={"status": "CONFIRMED"},
            headers=TRAVELER_HEADERS,
        )
        assert res_trav.status_code == 403
        assert "owning" in res_trav.json()["error"].lower()

        # 2. Non-owning planner attempts status change -> 403 Forbidden
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_OTHER_PLANNER)
        res_other = client.patch(
            f"/api/bookings/{BOOKING_ID}/status",
            json={"status": "CONFIRMED"},
            headers=OTHER_PLANNER_HEADERS,
        )
        assert res_other.status_code == 403
        assert "owning" in res_other.json()["error"].lower()

        # 3. Owning planner confirms -> 200 OK
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_PLANNER)
        res_owner = client.patch(
            f"/api/bookings/{BOOKING_ID}/status",
            json={"status": "CONFIRMED"},
            headers=PLANNER_HEADERS,
        )
        assert res_owner.status_code == 200
        assert res_owner.json()["status"] == "CONFIRMED"

        # 4. Owning planner cancels -> 200 OK
        def cancel_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_PLANNER
            if "FROM bookings b" in query:
                return booking_row
            if "UPDATE bookings" in query:
                return {**booking_row, "status": "CANCELLED"}
            return None

        mock_fetchrow.side_effect = cancel_side_effect
        res_cancel = client.patch(
            f"/api/bookings/{BOOKING_ID}/status",
            json={"status": "CANCELLED"},
            headers=PLANNER_HEADERS,
        )
        assert res_cancel.status_code == 200
        assert res_cancel.json()["status"] == "CANCELLED"


# ---------------------------------------------------------------------------
# 3. TRAVELER BOOKING HISTORY
# ---------------------------------------------------------------------------
def test_traveler_booking_history(client: TestClient):
    """
    CHECKLIST TEST:
    Booking history works for travelers.
    """
    mock_history = [
        {
            "id": BOOKING_ID,
            "departure_id": DEP_ID,
            "traveler_id": TRAVELER_ID,
            "travelers_count": 2,
            "status": "CONFIRMED",
            "tour_title": "Sylhet Tea Country Expedition",
            "price": 8500,
            "start_date": date(2025, 6, 12),
            "end_date": date(2025, 6, 15),
            "destination_name": "Ratargul Swamp Forest",
        }
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        mock_fetchrow.return_value = MOCK_TRAVELER
        mock_fetch.return_value = mock_history

        res = client.get("/api/me/bookings", headers=TRAVELER_HEADERS)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["tour_title"] == "Sylhet Tea Country Expedition"
        assert items[0]["price"] == 8500
        assert items[0]["destination_name"] == "Ratargul Swamp Forest"
        assert items[0]["status"] == "CONFIRMED"


# ---------------------------------------------------------------------------
# 4. TOURS CRUD & PERMISSIONS
# ---------------------------------------------------------------------------
def test_tour_creation_role_restriction(client: TestClient):
    """Only TOUR_PLANNER or ADMIN can create commercial tours."""
    payload = {
        "destinationId": str(DEST_ID),
        "title": "Bandarban High Trek",
        "description": "High altitude trekking through Keokradong and Saka Haphong.",
        "price": 16500,
        "capacity": 8,
        "status": "PUBLISHED",
    }

    # 1. TRAVELER fails with 403
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.return_value = MOCK_TRAVELER
        res = client.post("/api/tours", json=payload, headers=TRAVELER_HEADERS)
        assert res.status_code == 403
        assert res.json()["error"] == "Tour planner role required"

    # 2. TOUR_PLANNER succeeds
    created_tour = {
        "id": TOUR_ID,
        "planner_id": PLANNER_ID,
        "destination_id": DEST_ID,
        "title": "Bandarban High Trek",
        "description": "High altitude trekking through Keokradong and Saka Haphong.",
        "price": 16500,
        "capacity": 8,
        "status": "PUBLISHED",
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_PLANNER
            if "FROM destinations" in query:
                return {"id": DEST_ID}
            if "INSERT INTO tours" in query:
                return created_tour
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        res = client.post("/api/tours", json=payload, headers=PLANNER_HEADERS)
        assert res.status_code == 201
        assert res.json()["id"] == str(TOUR_ID)
        assert res.json()["title"] == "Bandarban High Trek"


def test_tour_update_permissions(client: TestClient):
    """Only the tour's creator or admin can update the tour."""
    existing_tour = {
        "id": TOUR_ID,
        "planner_id": PLANNER_ID,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(user_obj):
            def side_effect(query, *args):
                if "FROM users" in query:
                    return user_obj
                if "FROM tours" in query:
                    return existing_tour
                if "UPDATE tours" in query:
                    return {**existing_tour, "title": "Updated Title"}
                return None
            return side_effect

        # Other planner gets 403
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_OTHER_PLANNER)
        res_other = client.put(f"/api/tours/{TOUR_ID}", json={"title": "Updated Title"}, headers=OTHER_PLANNER_HEADERS)
        assert res_other.status_code == 403

        # Owning planner succeeds
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_PLANNER)
        res_owner = client.put(f"/api/tours/{TOUR_ID}", json={"title": "Updated Title"}, headers=PLANNER_HEADERS)
        assert res_owner.status_code == 200
        assert res_owner.json()["title"] == "Updated Title"


def test_add_tour_departure_flow(client: TestClient):
    """Adding departures requires ownership and valid date ranges."""
    existing_tour = {
        "id": TOUR_ID,
        "planner_id": PLANNER_ID,
    }
    created_dep = {
        "id": DEP_ID,
        "tour_id": TOUR_ID,
        "start_date": date(2025, 7, 1),
        "end_date": date(2025, 7, 5),
        "capacity": 12,
        "status": "OPEN",
    }

    # 1. Invalid dates (end < start)
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_PLANNER
            if "FROM tours" in query:
                return existing_tour
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        res_bad_dates = client.post(
            f"/api/tours/{TOUR_ID}/departures",
            json={"startDate": "2025-07-05", "endDate": "2025-07-01", "capacity": 12},
            headers=PLANNER_HEADERS,
        )
        assert res_bad_dates.status_code == 400

    # 2. Successful creation by owning planner
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_PLANNER
            if "FROM tours" in query:
                return existing_tour
            if "INSERT INTO tour_departures" in query:
                return created_dep
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect
        res = client.post(
            f"/api/tours/{TOUR_ID}/departures",
            json={"startDate": "2025-07-01", "endDate": "2025-07-05", "capacity": 12},
            headers=PLANNER_HEADERS,
        )
        assert res.status_code == 201
        assert res.json()["id"] == str(DEP_ID)


# ---------------------------------------------------------------------------
# 5. PUBLIC DISCOVERY & PLANNER DASHBOARD ENDPOINTS
# ---------------------------------------------------------------------------
def test_public_tours_and_detail(client: TestClient):
    """Public endpoints list published tours and detailed itineraries with departures."""
    sample_tours = [
        {
            "id": TOUR_ID,
            "title": "Sylhet Tea Country",
            "destination_name": "Sreemangal",
            "destination_image": "https://example.com/tea.jpg",
            "district": "Moulvibazar",
            "division": "Sylhet Division",
            "planner_name": "Nadia Tour Guide",
            "departures_count": 2,
            "price": 8500,
            "capacity": 12,
            "status": "PUBLISHED",
        }
    ]

    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = sample_tours
        res = client.get("/api/tours")
        assert res.status_code == 200
        tours = res.json()
        assert len(tours) == 1
        assert tours[0]["title"] == "Sylhet Tea Country"

    # Detail
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = {
            **sample_tours[0],
            "description": "Full tour itinerary",
            "planner_bio": "Certified mountain and eco guide.",
        }
        mock_fetch.return_value = [
            {
                "id": DEP_ID,
                "tour_id": TOUR_ID,
                "start_date": date(2025, 6, 12),
                "end_date": date(2025, 6, 15),
                "capacity": 12,
                "status": "OPEN",
                "booked_count": 4,
            }
        ]

        res_detail = client.get(f"/api/tours/{TOUR_ID}")
        assert res_detail.status_code == 200
        data = res_detail.json()
        assert data["title"] == "Sylhet Tea Country"
        assert len(data["departures"]) == 1
        assert data["departures"][0]["booked_count"] == 4


def test_planner_dashboard_endpoints(client: TestClient):
    """Planner dashboard lists planner's tours, departures, and bookings."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        mock_fetchrow.return_value = MOCK_PLANNER

        # 1. Planner tours
        mock_fetch.return_value = [
            {
                "id": TOUR_ID,
                "title": "Sylhet Odyssey",
                "destination_name": "Sylhet",
                "departures_count": 1,
                "total_participants": 6,
                "price": 8500,
            }
        ]
        res_tours = client.get("/api/planner/tours", headers=PLANNER_HEADERS)
        assert res_tours.status_code == 200
        assert len(res_tours.json()) == 1

        # 2. Planner departures
        mock_fetch.return_value = [
            {
                "id": DEP_ID,
                "tour_title": "Sylhet Odyssey",
                "destination_name": "Sylhet",
                "start_date": date(2025, 6, 12),
                "end_date": date(2025, 6, 15),
                "capacity": 12,
                "booked_count": 6,
                "status": "OPEN",
            }
        ]
        res_deps = client.get("/api/planner/departures", headers=PLANNER_HEADERS)
        assert res_deps.status_code == 200
        assert len(res_deps.json()) == 1
        assert res_deps.json()[0]["booked_count"] == 6

        # 3. Planner bookings
        mock_fetch.return_value = [
            {
                "id": BOOKING_ID,
                "departure_id": DEP_ID,
                "traveler_name": "Rafi Ahmed",
                "traveler_email": "traveler@porikroma.com",
                "tour_title": "Sylhet Odyssey",
                "tour_price": 8500,
                "travelers_count": 2,
                "status": "CONFIRMED",
            }
        ]
        res_books = client.get("/api/planner/bookings", headers=PLANNER_HEADERS)
        assert res_books.status_code == 200
        assert len(res_books.json()) == 1
        assert res_books.json()[0]["traveler_name"] == "Rafi Ahmed"
