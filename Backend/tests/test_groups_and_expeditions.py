from datetime import date, datetime
import json
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


ORGANIZER_ID = uuid.UUID("11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
APPLICANT_ID = uuid.UUID("22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
STRANGER_ID = uuid.UUID("33333333-cccc-cccc-cccc-cccccccccccc")
ADMIN_ID = uuid.UUID("44444444-dddd-dddd-dddd-dddddddddddd")

TRIP_ID = uuid.UUID("55555555-eeee-eeee-eeee-eeeeeeeeeeee")
GROUP_ID = uuid.UUID("66666666-ffff-ffff-ffff-ffffffffffff")
APP_ID = uuid.UUID("77777777-1111-2222-3333-444444444444")
MSG_ID = uuid.UUID("88888888-5555-6666-7777-888888888888")
NOTIF_ID = uuid.UUID("99999999-aaaa-bbbb-cccc-dddddddddddd")

MOCK_ORGANIZER = {
    "id": ORGANIZER_ID,
    "email": "organizer@test.com",
    "name": "Nadia Rahman",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_APPLICANT = {
    "id": APPLICANT_ID,
    "email": "applicant@test.com",
    "name": "Samira Rahman",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_STRANGER = {
    "id": STRANGER_ID,
    "email": "stranger@test.com",
    "name": "Stranger User",
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

MOCK_GROUP = {
    "id": GROUP_ID,
    "trip_id": TRIP_ID,
    "organizer_id": ORGANIZER_ID,
    "title": "Sylhet Rain & River Expedition",
    "capacity": 3,
    "budget_per_person": 7000,
    "published": True,
    "trip_name": "Sylhet Rain Expedition",
    "start_date": date(2025, 7, 10),
    "end_date": date(2025, 7, 14),
    "destination_name": "Ratargul",
    "destination_image": "https://images.unsplash.com/ratargul.jpg",
    "district": "Sylhet",
    "division": "Sylhet Division",
    "organizer_name": "Nadia Rahman",
    "organizer_avatar": "",
    "member_count": 1,
}


def make_auth_header(user_id: uuid.UUID, email: str, role: str) -> dict:
    token = create_access_token({"id": str(user_id), "email": email, "role": role})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. PUBLISH GROUP EXPEDITION WITH SEAT CAP
# ---------------------------------------------------------------------------
def test_publish_group_expedition(client: TestClient):
    auth_org = make_auth_header(ORGANIZER_ID, "organizer@test.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # 1: auth, 2: trip check, 3: insert group
        mock_fetchrow.side_effect = [
            MOCK_ORGANIZER,
            {"creator_id": ORGANIZER_ID},
            MOCK_GROUP,
        ]

        payload = {
            "tripId": str(TRIP_ID),
            "title": "Sylhet Rain & River Expedition",
            "capacity": 3,
            "budgetPerPerson": 7000,
            "published": True,
        }
        res = client.post("/api/groups", json=payload, headers=auth_org)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == str(GROUP_ID)
        assert data["title"] == "Sylhet Rain & River Expedition"
        assert data["capacity"] == 3

        # Verify organizer auto-joined to group_members
        mock_execute.assert_awaited_with(
            "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            GROUP_ID,
            ORGANIZER_ID,
        )


# ---------------------------------------------------------------------------
# 2. BROWSE EXPEDITIONS, DETAIL, AND MY-GROUPS
# ---------------------------------------------------------------------------
def test_list_and_get_groups(client: TestClient):
    with patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetch.return_value = [MOCK_GROUP]

        # Public list
        res = client.get("/api/groups")
        assert res.status_code == 200
        assert len(res.json()) == 1

        # Group detail with itinerary and members
        mock_fetchrow.return_value = MOCK_GROUP
        mock_fetch.side_effect = [
            [{"id": ORGANIZER_ID, "name": "Nadia Rahman", "email": "organizer@test.com", "avatar_url": ""}],
            [{"id": uuid.uuid4(), "day_date": date(2025, 7, 10), "title": "Boat Cruise", "sort_order": 0}],
        ]
        res_detail = client.get(f"/api/groups/{GROUP_ID}")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["title"] == "Sylhet Rain & River Expedition"
        assert len(detail["members"]) == 1
        assert len(detail["itinerary"]) == 1

    # My Groups
    auth_org = make_auth_header(ORGANIZER_ID, "organizer@test.com", "TRAVELER")
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_ORGANIZER
        mock_fetch.return_value = [{**MOCK_GROUP, "is_organizer": True}]

        res_my = client.get("/api/groups/my-groups", headers=auth_org)
        assert res_my.status_code == 200
        assert res_my.json()[0]["is_organizer"] is True


# ---------------------------------------------------------------------------
# 3. APPLY TO EXPEDITION WITH MULTIPLE QUESTIONS & SEAT CAP
# ---------------------------------------------------------------------------
def test_apply_to_group_expedition_and_seat_cap(client: TestClient):
    auth_app = make_auth_header(APPLICANT_ID, "applicant@test.com", "TRAVELER")

    answers = {
        "experience": "Comfortable with long boat rides and trekking.",
        "dietary": "Halal only",
        "commitment": "Yes, fully committed to travel dates.",
    }

    mock_app_record = {
        "id": APP_ID,
        "group_id": GROUP_ID,
        "applicant_id": APPLICANT_ID,
        "answers": answers,
        "status": "PENDING",
        "created_at": datetime(2025, 7, 1, 10, 0),
    }

    # 3a. Successful application & notification creation
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [
            MOCK_APPLICANT,          # 1: auth
            MOCK_GROUP,              # 2: group lookup
            None,                    # 3: is_member check -> False
            {"member_count": 1},     # 4: count check -> 1 of 3 (not full)
            mock_app_record,         # 5: insert row returning
        ]

        res = client.post(
            f"/api/groups/{GROUP_ID}/applications",
            json=answers,
            headers=auth_app,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "PENDING"
        assert data["answers"]["dietary"] == "Halal only"

        # Verify notification created for organizer
        mock_execute.assert_awaited_with(
            "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
            ORGANIZER_ID,
            "GROUP_APPLICATION",
            f"New join request for {MOCK_GROUP['title']}",
            "/group-travel/requests",
        )

    # 3b. Seat cap enforcement when applying to a full group
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_APPLICANT,
            MOCK_GROUP,
            None,
            {"member_count": 3},  # Full (3 of 3)
        ]
        res_full = client.post(
            f"/api/groups/{GROUP_ID}/applications",
            json=answers,
            headers=auth_app,
        )
        assert res_full.status_code == 400
        assert "seat capacity" in res_full.json()["error"].lower()


# ---------------------------------------------------------------------------
# 4. APPROVE, REJECT, WITHDRAW & ENFORCE SEAT CAP ON APPROVAL
# ---------------------------------------------------------------------------
def test_approve_reject_application_flow(client: TestClient):
    auth_org = make_auth_header(ORGANIZER_ID, "organizer@test.com", "TRAVELER")
    auth_stranger = make_auth_header(STRANGER_ID, "stranger@test.com", "TRAVELER")

    app_joined = {
        "id": APP_ID,
        "group_id": GROUP_ID,
        "applicant_id": APPLICANT_ID,
        "organizer_id": ORGANIZER_ID,
        "capacity": 3,
        "trip_id": TRIP_ID,
        "group_title": "Sylhet Rain & River Expedition",
        "status": "PENDING",
    }

    # 4a. Non-organizer cannot approve or reject (403)
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [MOCK_STRANGER, app_joined]
        res_unauth = client.patch(
            f"/api/applications/{APP_ID}/status",
            json={"status": "APPROVED"},
            headers=auth_stranger,
        )
        assert res_unauth.status_code == 403
        assert "organizer" in res_unauth.json()["error"].lower()

    # 4b. Seat cap enforcement on approval when capacity is exceeded
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_ORGANIZER,
            app_joined,
            {"member_count": 3},  # Already at capacity 3
        ]
        res_cap = client.patch(
            f"/api/applications/{APP_ID}/status",
            json={"status": "APPROVED"},
            headers=auth_org,
        )
        assert res_cap.status_code == 400
        assert "capacity" in res_cap.json()["error"].lower()

    # 4c. Successful approval: adds to group_members, trip_members, and notifies applicant
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [
            MOCK_ORGANIZER,
            app_joined,
            {"member_count": 2},  # 2 of 3 spots (has space!)
            {**app_joined, "status": "APPROVED"},
        ]
        res_ok = client.patch(
            f"/api/applications/{APP_ID}/status",
            json={"status": "APPROVED"},
            headers=auth_org,
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "APPROVED"

        # Verify added to group_members, trip_members, and notification sent
        assert mock_execute.await_count == 3

    # 4d. Organizer rejects application: sets REJECTED and notifies applicant
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [
            MOCK_ORGANIZER,
            app_joined,
            {**app_joined, "status": "REJECTED"},
        ]
        res_rej = client.patch(
            f"/api/applications/{APP_ID}/status",
            json={"status": "REJECTED"},
            headers=auth_org,
        )
        assert res_rej.status_code == 200
        assert res_rej.json()["status"] == "REJECTED"
        mock_execute.assert_awaited_with(
            "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
            APPLICANT_ID,
            "APPLICATION_REJECTED",
            f"Your application to join {app_joined['group_title']} was not approved.",
            "/group-travel/requests",
        )


# ---------------------------------------------------------------------------
# 5. USER'S APPLICATIONS LIST
# ---------------------------------------------------------------------------
def test_list_my_group_applications(client: TestClient):
    auth_app = make_auth_header(APPLICANT_ID, "applicant@test.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_APPLICANT
        mock_fetch.return_value = [{
            "id": APP_ID,
            "group_id": GROUP_ID,
            "group_title": "Sylhet Rain & River Expedition",
            "destination_name": "Ratargul",
            "organizer_name": "Nadia Rahman",
            "status": "APPROVED",
        }]

        res = client.get("/api/me/group-applications", headers=auth_app)
        assert res.status_code == 200
        apps = res.json()
        assert len(apps) == 1
        assert apps[0]["group_title"] == "Sylhet Rain & River Expedition"


# ---------------------------------------------------------------------------
# 6. GROUP CHAT / MESSAGES (APPROVED MEMBERS ONLY)
# ---------------------------------------------------------------------------
def test_group_chat_members_only(client: TestClient):
    """
    CHECKLIST TEST:
    Only approved members can read or post chat messages.
    """
    auth_app = make_auth_header(APPLICANT_ID, "applicant@test.com", "TRAVELER")
    auth_stranger = make_auth_header(STRANGER_ID, "stranger@test.com", "TRAVELER")

    # 6a. Non-member rejected when trying to read messages
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_STRANGER,
            None,  # Not in group_members
        ]
        res_read_fail = client.get(f"/api/groups/{GROUP_ID}/messages", headers=auth_stranger)
        assert res_read_fail.status_code == 403
        assert res_read_fail.json() == {"error": "Only confirmed group members can access group chat"}

    # 6b. Non-member rejected when trying to post message
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_STRANGER,
            None,
        ]
        res_post_fail = client.post(
            f"/api/groups/{GROUP_ID}/messages",
            json={"body": "Hello anyone?"},
            headers=auth_stranger,
        )
        assert res_post_fail.status_code == 403
        assert res_post_fail.json() == {"error": "Only confirmed group members can access group chat"}

    # 6c. Confirmed member can read messages
    mock_msg = {
        "id": MSG_ID,
        "group_id": GROUP_ID,
        "sender_id": APPLICANT_ID,
        "body": "Excited to join this Sylhet trip!",
        "created_at": datetime(2025, 7, 2, 12, 0),
        "sender_name": "Samira Rahman",
        "sender_avatar": "",
    }
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.side_effect = [
            MOCK_APPLICANT,
            {"exists": 1},  # Membership check succeeds
        ]
        mock_fetch.return_value = [mock_msg]

        res_read = client.get(f"/api/groups/{GROUP_ID}/messages", headers=auth_app)
        assert res_read.status_code == 200
        msgs = res_read.json()
        assert len(msgs) == 1
        assert msgs[0]["body"] == "Excited to join this Sylhet trip!"

    # 6d. Confirmed member can post message
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_APPLICANT,
            {"exists": 1},  # Membership check succeeds
            mock_msg,       # Insert message
        ]
        res_post = client.post(
            f"/api/groups/{GROUP_ID}/messages",
            json={"body": "Excited to join this Sylhet trip!"},
            headers=auth_app,
        )
        assert res_post.status_code == 201
        data = res_post.json()
        assert data["body"] == "Excited to join this Sylhet trip!"
        assert data["sender_name"] == "Samira Rahman"


# ---------------------------------------------------------------------------
# 7. NOTIFICATIONS CRUD & MARK READ
# ---------------------------------------------------------------------------
def test_notifications_flow(client: TestClient):
    """
    CHECKLIST TEST:
    Notifications are created and can be marked read.
    """
    auth_app = make_auth_header(APPLICANT_ID, "applicant@test.com", "TRAVELER")

    mock_notif = {
        "id": NOTIF_ID,
        "user_id": APPLICANT_ID,
        "type": "APPLICATION_APPROVED",
        "detail": "Your application was approved!",
        "link": "/group-travel/my-groups",
        "read": False,
        "created_at": datetime(2025, 7, 1, 12, 0),
    }

    # 7a. List notifications
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_APPLICANT
        mock_fetch.return_value = [mock_notif]

        res = client.get("/api/notifications", headers=auth_app)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["type"] == "APPLICATION_APPROVED"
        assert items[0]["read"] is False

    # 7b. Mark single notification as read
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_APPLICANT,
            {**mock_notif, "read": True},
        ]
        res_read = client.patch(f"/api/notifications/{NOTIF_ID}/read", headers=auth_app)
        assert res_read.status_code == 200
        assert res_read.json()["read"] is True

    # 7c. Mark all notifications as read
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.return_value = MOCK_APPLICANT
        res_all = client.patch("/api/notifications/read-all", headers=auth_app)
        assert res_all.status_code == 200
        assert res_all.json() == {"success": True}
        mock_execute.assert_awaited_with(
            "UPDATE notifications SET read = true WHERE user_id = $1",
            APPLICANT_ID,
        )

    # 7d. Delete notification
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.return_value = MOCK_APPLICANT
        res_del = client.delete(f"/api/notifications/{NOTIF_ID}", headers=auth_app)
        assert res_del.status_code == 200
        assert res_del.json() == {"success": True}
        mock_execute.assert_awaited_with(
            "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
            NOTIF_ID,
            APPLICANT_ID,
        )
