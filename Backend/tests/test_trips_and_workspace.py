from datetime import date, datetime
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


USER_1_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_2_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
ADMIN_ID = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")

TRIP_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")
DEST_ID = uuid.UUID("66666666-7777-8888-9999-000000000000")
ITEM_ID = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

MOCK_USER_1 = {
    "id": USER_1_ID,
    "email": "traveler1@test.com",
    "name": "Traveler One",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_USER_2 = {
    "id": USER_2_ID,
    "email": "traveler2@test.com",
    "name": "Traveler Two",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_ADMIN = {
    "id": ADMIN_ID,
    "email": "admin@test.com",
    "name": "Admin User",
    "role": "ADMIN",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_TRIP = {
    "id": TRIP_ID,
    "creator_id": USER_1_ID,
    "destination_id": DEST_ID,
    "name": "Sylhet Rain & River Expedition",
    "start_date": date(2025, 7, 10),
    "end_date": date(2025, 7, 14),
    "visibility": "PUBLIC",
    "status": "PLANNING",
    "budget": 7000,
    "description": "A 4-day shared journey through freshwater swamps.",
    "created_at": datetime(2025, 1, 1, 10, 0),
    "destination_name": "Sylhet Tea Hills",
    "destination_image": "https://images.unsplash.com/sylhet.jpg",
    "district": "Sylhet",
    "division": "Sylhet Division",
    "total_spent": 6000,
    "member_count": 2,
}

MOCK_PRIVATE_TRIP = {
    **MOCK_TRIP,
    "id": uuid.UUID("22222222-3333-4444-5555-666666666666"),
    "visibility": "PRIVATE",
    "name": "Private Sundarbans Trek",
}


def make_auth_header(user_id: uuid.UUID, email: str, role: str) -> dict:
    token = create_access_token({"id": str(user_id), "email": email, "role": role})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. TRIPS LISTING & FILTERS
# ---------------------------------------------------------------------------
def test_list_trips_with_filters(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER_1
        mock_fetch.return_value = [MOCK_TRIP]

        # Call without filters
        res = client.get("/api/trips", headers=auth_header)
        assert res.status_code == 200
        trips = res.json()
        assert len(trips) == 1
        assert trips[0]["name"] == "Sylhet Rain & River Expedition"
        assert trips[0]["total_spent"] == 6000
        assert trips[0]["member_count"] == 2

        # Call with filters
        res_filtered = client.get("/api/trips?status=PLANNING&visibility=PUBLIC", headers=auth_header)
        assert res_filtered.status_code == 200


# ---------------------------------------------------------------------------
# 2. CREATE TRIP & AUTO ASSIGN OWNER
# ---------------------------------------------------------------------------
def test_create_trip_and_add_owner(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # First call loads user for auth, second returns newly inserted trip
        mock_fetchrow.side_effect = [MOCK_USER_1, MOCK_TRIP]

        payload = {
            "name": "Sylhet Rain & River Expedition",
            "destinationId": str(DEST_ID),
            "startDate": "2025-07-10",
            "endDate": "2025-07-14",
            "visibility": "PUBLIC",
            "status": "PLANNING",
            "budget": 7000,
            "description": "A 4-day shared journey through freshwater swamps.",
        }
        res = client.post("/api/trips", json=payload, headers=auth_header)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == str(TRIP_ID)
        assert data["name"] == "Sylhet Rain & River Expedition"

        # Verify creator added to trip_members as OWNER
        mock_execute.assert_awaited_with(
            "INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING",
            TRIP_ID,
            USER_1_ID,
        )


# ---------------------------------------------------------------------------
# 3. WORKSPACE ELEMENTS (ITINERARY, CHECKLIST, NOTES, MAP PLACES)
# ---------------------------------------------------------------------------
def test_workspace_crud_flow(client: TestClient):
    """
    CHECKLIST TEST:
    Create itinerary items, checklist items, notes and map places.
    """
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    # 3a. Add Itinerary item
    itinerary_item = {
        "id": ITEM_ID,
        "trip_id": TRIP_ID,
        "day_date": date(2025, 7, 10),
        "title": "Arrival & Lalakhal Boat Ride",
        "location": "Lalakhal River",
        "notes": "Bring waterproof bags",
        "sort_order": 1,
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        # 1: auth user, 2: check_trip_access, 3: insert row
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}, itinerary_item]

        res = client.post(
            f"/api/trips/{TRIP_ID}/itinerary",
            json={
                "dayDate": "2025-07-10",
                "title": "Arrival & Lalakhal Boat Ride",
                "location": "Lalakhal River",
                "notes": "Bring waterproof bags",
                "sortOrder": 1,
            },
            headers=auth_header,
        )
        assert res.status_code == 201
        assert res.json()["title"] == "Arrival & Lalakhal Boat Ride"

    # 3b. Add Checklist item and toggle completed
    chk_item = {
        "id": ITEM_ID,
        "trip_id": TRIP_ID,
        "title": "Rain poncho and dry bag",
        "completed": False,
        "created_by": USER_1_ID,
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}, chk_item]
        res = client.post(
            f"/api/trips/{TRIP_ID}/checklist",
            json={"title": "Rain poncho and dry bag"},
            headers=auth_header,
        )
        assert res.status_code == 201
        assert res.json()["title"] == "Rain poncho and dry bag"

    # Toggle checklist item
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {"exists": 1},
            {**chk_item, "completed": True},
        ]
        res_toggle = client.patch(
            f"/api/trips/{TRIP_ID}/checklist/{ITEM_ID}",
            json={"completed": True},
            headers=auth_header,
        )
        assert res_toggle.status_code == 200
        assert res_toggle.json()["completed"] is True

    # 3c. Add Note
    note_item = {
        "id": ITEM_ID,
        "trip_id": TRIP_ID,
        "author_id": USER_1_ID,
        "body": "Remember to try seven-layer tea at Nilkantha cabin.",
        "created_at": datetime(2025, 7, 10, 14, 0),
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}, note_item]
        res_note = client.post(
            f"/api/trips/{TRIP_ID}/notes",
            json={"body": "Remember to try seven-layer tea at Nilkantha cabin."},
            headers=auth_header,
        )
        assert res_note.status_code == 201
        assert "seven-layer tea" in res_note.json()["body"]

    # 3d. Add Map Place
    place_item = {
        "id": ITEM_ID,
        "trip_id": TRIP_ID,
        "name": "Lalakhal River Basin",
        "category": "Nature",
        "notes": "Best emerald reflections at 4 PM",
        "lat": 25.12,
        "lng": 92.18,
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}, place_item]
        res_place = client.post(
            f"/api/trips/{TRIP_ID}/map-places",
            json={
                "name": "Lalakhal River Basin",
                "category": "Nature",
                "notes": "Best emerald reflections at 4 PM",
                "lat": 25.12,
                "lng": 92.18,
            },
            headers=auth_header,
        )
        assert res_place.status_code == 201
        assert res_place.json()["name"] == "Lalakhal River Basin"


# ---------------------------------------------------------------------------
# 4. PRIVATE TRIP ACCESS CONTROL (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_non_member_cannot_read_or_edit_private_trip(client: TestClient):
    """
    CHECKLIST TEST:
    A non-member cannot read or edit a private trip.
    """
    priv_id = MOCK_PRIVATE_TRIP["id"]
    # User 2 is not a member of private trip
    auth_u2 = make_auth_header(USER_2_ID, "traveler2@test.com", "TRAVELER")

    # 1. Non-member cannot read private trip
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        # fetchrow 1: user 2 profile, 2: trip details, 3: check_trip_access -> returns None
        mock_fetchrow.side_effect = [MOCK_USER_2, MOCK_PRIVATE_TRIP, None]
        res = client.get(f"/api/trips/{priv_id}", headers=auth_u2)
        assert res.status_code == 403
        assert res.json() == {"error": "Trip membership required"}

    # 2. Non-member cannot read private workspace
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        # fetchrow 1: user 2 profile, 2: workspace trip details, 3: check_trip_access -> returns None
        mock_fetchrow.side_effect = [MOCK_USER_2, MOCK_PRIVATE_TRIP, None]
        res_ws = client.get(f"/api/trips/{priv_id}/workspace", headers=auth_u2)
        assert res_ws.status_code == 403
        assert res_ws.json() == {"error": "Trip membership required"}

    # 3. Non-member cannot edit private trip (returns 403 Trip ownership required)
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_2, None]  # access check fails
        res_edit = client.put(
            f"/api/trips/{priv_id}",
            json={"name": "Hacked Trip Name"},
            headers=auth_u2,
        )
        assert res_edit.status_code == 403
        assert res_edit.json() == {"error": "Trip ownership required"}

    # 4. Non-member cannot delete private trip
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_2, None]
        res_del = client.delete(f"/api/trips/{priv_id}", headers=auth_u2)
        assert res_del.status_code == 403
        assert res_del.json() == {"error": "Trip ownership required"}

    # 5. Non-member cannot add itinerary item
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_2, None]
        res_itin = client.post(
            f"/api/trips/{priv_id}/itinerary",
            json={"dayDate": "2025-07-10", "title": "Unauthorized Item"},
            headers=auth_u2,
        )
        assert res_itin.status_code == 403
        assert res_itin.json() == {"error": "Trip membership required"}

    # 6. Non-member cannot add checklist item
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_2, None]
        res_chk = client.post(
            f"/api/trips/{priv_id}/checklist",
            json={"title": "Unauthorized item"},
            headers=auth_u2,
        )
        assert res_chk.status_code == 403
        assert res_chk.json() == {"error": "Trip membership required"}


# ---------------------------------------------------------------------------
# 5. FULL WORKSPACE LOADER (ALL 8 TABS)
# ---------------------------------------------------------------------------
def test_get_trip_workspace_full_payload(client: TestClient):
    """
    CHECKLIST TEST:
    Trip workspace pages in the frontend work by supplying all 8 required tabs.
    """
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    mock_itin = [{
        "id": ITEM_ID,
        "trip_id": TRIP_ID,
        "day_date": date(2025, 7, 10),
        "title": "Day 1 Tour",
        "location": "Lalakhal",
        "notes": "",
        "sort_order": 0,
    }]
    mock_chk = [{"id": ITEM_ID, "title": "Passport", "completed": True}]
    mock_notes = [{"id": ITEM_ID, "body": "✦ Memory: Crystal water reflections", "author_name": "Traveler One"}]
    mock_photos = [{"id": ITEM_ID, "url": "https://img.com/tea.jpg", "caption": "Tea garden"}]
    mock_members = [{"id": USER_1_ID, "name": "Traveler One", "email": "traveler1@test.com", "role": "OWNER"}]
    mock_expenses = [{"id": ITEM_ID, "title": "Boat", "category": "Transport", "amount": 2500, "expense_date": date(2025, 7, 10), "paid_by_name": "Traveler One"}]
    mock_map = [{"id": ITEM_ID, "name": "Jaflong", "category": "Nature", "notes": ""}]
    mock_group = {"id": ITEM_ID, "trip_id": TRIP_ID, "title": "Sylhet Group Tour", "capacity": 5}

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        # 1st fetchrow: auth user, 2nd: trip query, 3rd: group_task
        mock_fetchrow.side_effect = [MOCK_USER_1, MOCK_TRIP, mock_group]
        # fetch is called for: itinerary, checklist, notes, photos, members, expenses, map_places
        mock_fetch.side_effect = [
            mock_itin,
            mock_chk,
            mock_notes,
            mock_photos,
            mock_members,
            mock_expenses,
            mock_map,
        ]

        res = client.get(f"/api/trips/{TRIP_ID}/workspace", headers=auth_header)
        assert res.status_code == 200
        ws = res.json()

        # Verify all 8 tabs are present and match Frontend's WorkspaceData shape
        assert "trip" in ws
        assert ws["trip"]["name"] == "Sylhet Rain & River Expedition"
        assert len(ws["itinerary"]) == 1
        assert len(ws["checklist"]) == 1
        assert len(ws["notes"]) == 1
        assert len(ws["photos"]) == 1
        assert len(ws["members"]) == 1
        assert len(ws["expenses"]) == 1
        assert len(ws["mapPlaces"]) == 1  # Note camelCase required by Frontend
        assert ws["group"]["title"] == "Sylhet Group Tour"


# ---------------------------------------------------------------------------
# 6. TRIP MEMBER INVITATIONS & REMOVAL
# ---------------------------------------------------------------------------
def test_trip_member_invitation_flow(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # 1: auth user, 2: check_trip_access, 3: target user lookup
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {"exists": 1},
            {"id": USER_2_ID, "name": "Traveler Two", "email": "traveler2@test.com"},
        ]

        res = client.post(
            f"/api/trips/{TRIP_ID}/members",
            json={"email": "traveler2@test.com"},
            headers=auth_header,
        )
        assert res.status_code == 201
        assert res.json()["email"] == "traveler2@test.com"

        # Check DB was called to insert member and notification
        assert mock_execute.await_count == 2

    # Remove member
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}]
        res_del = client.delete(
            f"/api/trips/{TRIP_ID}/members/{USER_2_ID}",
            headers=auth_header,
        )
        assert res_del.status_code == 200
        assert res_del.json() == {"success": True}


# ---------------------------------------------------------------------------
# 7. TRIP STATUS TRANSITION
# ---------------------------------------------------------------------------
def test_trip_status_transition(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {**MOCK_TRIP, "status": "COMPLETED"},
        ]
        res = client.patch(
            f"/api/trips/{TRIP_ID}/status",
            json={"status": "COMPLETED"},
            headers=auth_header,
        )
        assert res.status_code == 200
        assert res.json()["status"] == "COMPLETED"

    # Non-owner / unauthorized returns 404
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_USER_2, None]
        res_fail = client.patch(
            f"/api/trips/{TRIP_ID}/status",
            json={"status": "CANCELLED"},
            headers=make_auth_header(USER_2_ID, "traveler2@test.com", "TRAVELER"),
        )
        assert res_fail.status_code == 404
        assert res_fail.json() == {"error": "Trip not found or not owned by you"}


# ---------------------------------------------------------------------------
# 8. TRIP UPDATE AND DELETE
# ---------------------------------------------------------------------------
def test_trip_update_and_delete(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    # Update trip
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        # 1: auth user, 2: check_trip_access, 3: updated trip row
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {"exists": 1},
            {**MOCK_TRIP, "name": "Updated Sylhet Expedition"},
        ]
        res = client.put(
            f"/api/trips/{TRIP_ID}",
            json={"name": "Updated Sylhet Expedition", "budget": 8500},
            headers=auth_header,
        )
        assert res.status_code == 200
        assert res.json()["name"] == "Updated Sylhet Expedition"

    # Delete trip
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}]
        res_del = client.delete(f"/api/trips/{TRIP_ID}", headers=auth_header)
        assert res_del.status_code == 200
        assert res_del.json() == {"success": True}
        mock_execute.assert_awaited_with("DELETE FROM trips WHERE id = $1", TRIP_ID)


# ---------------------------------------------------------------------------
# 9. ITINERARY, CHECKLIST, NOTES & MAP PLACES DELETION / DETAILS
# ---------------------------------------------------------------------------
def test_workspace_subitems_edit_and_delete(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")

    # 9a. Update itinerary item
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {"exists": 1},
            {"id": ITEM_ID, "title": "Updated Lalakhal Morning Cruise"},
        ]
        res_itin = client.put(
            f"/api/trips/{TRIP_ID}/itinerary/{ITEM_ID}",
            json={"title": "Updated Lalakhal Morning Cruise"},
            headers=auth_header,
        )
        assert res_itin.status_code == 200
        assert res_itin.json()["title"] == "Updated Lalakhal Morning Cruise"

    # 9b. Delete itinerary item
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}]
        res_del_itin = client.delete(
            f"/api/trips/{TRIP_ID}/itinerary/{ITEM_ID}",
            headers=auth_header,
        )
        assert res_del_itin.status_code == 200
        assert res_del_itin.json() == {"success": True}

    # 9c. Delete checklist item
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}]
        res_del_chk = client.delete(
            f"/api/trips/{TRIP_ID}/checklist/{ITEM_ID}",
            headers=auth_header,
        )
        assert res_del_chk.status_code == 200
        assert res_del_chk.json() == {"success": True}

    # 9d. Delete note
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}]
        res_del_note = client.delete(
            f"/api/trips/{TRIP_ID}/notes/{ITEM_ID}",
            headers=auth_header,
        )
        assert res_del_note.status_code == 200
        assert res_del_note.json() == {"success": True}

    # 9e. List and delete map places
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # 1: auth user, 2: check_trip_read_access (fetchrow for trip details)
        mock_fetchrow.side_effect = [MOCK_USER_1, MOCK_TRIP]
        mock_fetch.return_value = [{"id": ITEM_ID, "name": "Lalakhal"}]
        res_map = client.get(f"/api/trips/{TRIP_ID}/map-places", headers=auth_header)
        assert res_map.status_code == 200
        assert len(res_map.json()) == 1

        # Delete map place
        mock_fetchrow.side_effect = [MOCK_USER_1, {"exists": 1}]
        res_del_map = client.delete(
            f"/api/trips/{TRIP_ID}/map-places/{ITEM_ID}",
            headers=auth_header,
        )
        assert res_del_map.status_code == 200
        assert res_del_map.json() == {"success": True}


# ---------------------------------------------------------------------------
# 10. ADMIN CAN ACCESS PRIVATE TRIP
# ---------------------------------------------------------------------------
def test_admin_can_access_private_trip(client: TestClient):
    auth_admin = make_auth_header(ADMIN_ID, "admin@test.com", "ADMIN")
    priv_id = MOCK_PRIVATE_TRIP["id"]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_ADMIN, MOCK_PRIVATE_TRIP]
        res = client.get(f"/api/trips/{priv_id}", headers=auth_admin)
        assert res.status_code == 200
        assert res.json()["id"] == str(priv_id)


# ---------------------------------------------------------------------------
# 11. TRIP PHOTOS & PERMISSIONS
# ---------------------------------------------------------------------------
def test_trip_photos_member_can_view_and_add(client: TestClient):
    """Trip members can view and add photos to the trip gallery."""
    auth_header = make_auth_header(USER_1_ID, "traveler1@test.com", "TRAVELER")
    photo_row = {
        "id": ITEM_ID,
        "trip_id": TRIP_ID,
        "user_id": USER_1_ID,
        "url": "https://images.unsplash.com/photo-test",
        "caption": "Tea gardens at dawn",
        "taken_at": "2025-06-12T08:00:00Z",
        "created_at": "2025-06-12T08:30:00Z",
        "user_name": "Traveler One",
    }

    # 1. View photos
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        # fetchrow for user, trip, access check
        mock_fetchrow.side_effect = [MOCK_USER_1, {"id": TRIP_ID, "creator_id": USER_1_ID}, {"exists": 1}]
        mock_fetch.return_value = [photo_row]

        res = client.get(f"/api/trips/{TRIP_ID}/photos", headers=auth_header)
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["url"] == "https://images.unsplash.com/photo-test"

    # 2. Add photo
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {"id": TRIP_ID, "creator_id": USER_1_ID},
            {"exists": 1},  # check_trip_access
            photo_row,      # INSERT RETURNING *
        ]

        res_post = client.post(
            f"/api/trips/{TRIP_ID}/photos",
            json={"url": "https://images.unsplash.com/photo-test", "caption": "Tea gardens at dawn"},
            headers=auth_header,
        )
        assert res_post.status_code == 201
        assert res_post.json()["caption"] == "Tea gardens at dawn"


def test_trip_photos_non_member_forbidden(client: TestClient):
    """Non-members cannot view or add photos to a trip."""
    non_member_auth = make_auth_header(USER_2_ID, "traveler2@test.com", "TRAVELER")

    # 1. Attempt to view photos -> 403
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_2,
            {"id": TRIP_ID, "creator_id": USER_1_ID},
            None,  # check_trip_access -> False
        ]
        res = client.get(f"/api/trips/{TRIP_ID}/photos", headers=non_member_auth)
        assert res.status_code == 403
        assert "membership required" in res.json()["error"].lower()

    # 2. Attempt to add photo -> 403
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_2,
            {"id": TRIP_ID, "creator_id": USER_1_ID},
            None,  # check_trip_access -> False
        ]
        res_post = client.post(
            f"/api/trips/{TRIP_ID}/photos",
            json={"url": "https://img.com/intruder.jpg"},
            headers=non_member_auth,
        )
        assert res_post.status_code == 403
        assert "membership required" in res_post.json()["error"].lower()


def test_trip_photos_delete_permission_enforcement(client: TestClient):
    """
    CHECKLIST TEST:
    Only the photo owner or trip organizer can delete a photo. Non-owners/non-organizers cannot.
    """
    OTHER_USER_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")
    organizer_auth = make_auth_header(USER_1_ID, "organizer@test.com", "TRAVELER")
    photo_owner_auth = make_auth_header(USER_2_ID, "owner@test.com", "TRAVELER")
    other_member_auth = make_auth_header(OTHER_USER_ID, "other@test.com", "TRAVELER")

    trip_record = {"id": TRIP_ID, "creator_id": USER_1_ID}
    photo_record = {"id": ITEM_ID, "trip_id": TRIP_ID, "user_id": USER_2_ID}

    # 1. Unrelated member attempts delete -> 403 Forbidden
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            {"id": OTHER_USER_ID, "email": "other@test.com", "role": "TRAVELER"},
            trip_record,
            {"exists": 1},  # check_trip_access -> member
            photo_record,   # photo found
        ]
        res = client.delete(f"/api/trips/{TRIP_ID}/photos/{ITEM_ID}", headers=other_member_auth)
        assert res.status_code == 403
        assert "photo owner or trip organizer" in res.json()["error"].lower()

    # 2. Photo owner deletes -> 200 OK
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:
        mock_fetchrow.side_effect = [
            MOCK_USER_2,
            trip_record,
            {"exists": 1},  # check_trip_access -> member
            photo_record,   # photo found with user_id == USER_2_ID
        ]
        res_owner = client.delete(f"/api/trips/{TRIP_ID}/photos/{ITEM_ID}", headers=photo_owner_auth)
        assert res_owner.status_code == 200
        assert res_owner.json() == {"success": True}

    # 3. Trip organizer deletes -> 200 OK
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            trip_record,    # creator_id == USER_1_ID
            {"exists": 1},  # check_trip_access -> member
            photo_record,   # photo found with user_id == USER_2_ID
        ]
        res_org = client.delete(f"/api/trips/{TRIP_ID}/photos/{ITEM_ID}", headers=organizer_auth)
        assert res_org.status_code == 200
        assert res_org.json() == {"success": True}

