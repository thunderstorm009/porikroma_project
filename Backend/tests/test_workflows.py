import os
from datetime import date, datetime, timezone
import json
import uuid
import asyncpg
from httpx import ASGITransport, AsyncClient
import pytest
from app.config import settings
from app.db import db
from app.main import app
from app.services.security import hash_password


TRAVELER1_ID = uuid.UUID("a1111111-1111-1111-1111-111111111111")
TRAVELER2_ID = uuid.UUID("a2222222-2222-2222-2222-222222222222")
PLANNER_ID = uuid.UUID("b1111111-1111-1111-1111-111111111111")
ADMIN_ID = uuid.UUID("c1111111-1111-1111-1111-111111111111")
DEST_SYLHET_ID = uuid.UUID("d1111111-1111-1111-1111-111111111111")


class StatefulWorkflowMock:
    """
    In-memory stateful database mock that records and relates entities across
    the multi-user test workflow scenarios when no live PostgreSQL is running.
    """

    def __init__(self):
        pw_hash = hash_password("password123")
        self.users = {
            "traveler@porikroma.com": {
                "id": TRAVELER1_ID,
                "email": "traveler@porikroma.com",
                "name": "Rafi Ahmed",
                "role": "TRAVELER",
                "status": "ACTIVE",
                "password_hash": pw_hash,
                "avatar": None,
                "is_verified": False,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            "traveler2@porikroma.com": {
                "id": TRAVELER2_ID,
                "email": "traveler2@porikroma.com",
                "name": "Samira Rahman",
                "role": "TRAVELER",
                "status": "ACTIVE",
                "password_hash": pw_hash,
                "avatar": None,
                "is_verified": False,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            "planner@porikroma.com": {
                "id": PLANNER_ID,
                "email": "planner@porikroma.com",
                "name": "Nadia Tour Guide",
                "role": "TOUR_PLANNER",
                "status": "ACTIVE",
                "password_hash": pw_hash,
                "avatar": None,
                "is_verified": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            "admin@porikroma.com": {
                "id": ADMIN_ID,
                "email": "admin@porikroma.com",
                "name": "Platform Admin",
                "role": "ADMIN",
                "status": "ACTIVE",
                "password_hash": pw_hash,
                "avatar": None,
                "is_verified": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        }
        self.destinations = {
            DEST_SYLHET_ID: {
                "id": DEST_SYLHET_ID,
                "name": "Sylhet Tea Gardens & Swamp Forests",
                "division": "Sylhet Division",
                "district": "Sylhet",
                "category": "Nature",
                "rating": 4.9,
                "estimated_budget": 12000,
                "cover_image": "https://example.com/sylhet.jpg",
                "image": "https://example.com/sylhet.jpg",
            }
        }
        self.trips = {}
        self.trip_members = {}
        self.groups = {}
        self.group_members = set()
        self.itinerary = {}
        self.expenses = {}
        self.checklists = {}
        self.notes = {}
        self.places = {}
        self.applications = {}
        self.messages = []
        self.tours = {}
        self.departures = {}
        self.bookings = {}

    def get_user_by_id(self, uid):
        for u in self.users.values():
            if str(u["id"]) == str(uid):
                return u
        return None

    async def fetchrow(self, query: str, *args):
        # 1. Auth lookup by email
        if ("WHERE email = lower($1)" in query) or ("WHERE email = $1" in query) or ("WHERE u.email = lower($1)" in query):
            email = str(args[0]).lower()
            return self.users.get(email)

        # 2. Current user lookup by ID
        if ("FROM users" in query or "FROM users u" in query) and ("WHERE id = $1" in query or "WHERE u.id = $1" in query):
            uid = args[0]
            return self.get_user_by_id(uid)

        # 3. Trip access / membership checks
        if "FROM trip_members" in query and "user_id" in query:
            return {"role": "OWNER"}

        if "SELECT 1 FROM trip_members" in query:
            return {"exists": 1}

        # 4. Single trip lookup / workspace header
        if "FROM trips" in query and ("WHERE t.id = $1" in query or "WHERE id = $1" in query):
            trip_id = str(args[0])
            trip = self.trips.get(trip_id)
            if trip:
                return {
                    **trip,
                    "destination_name": "Sylhet",
                    "destination_image": "https://example.com/sylhet.jpg",
                    "district": "Sylhet",
                    "division": "Sylhet Division",
                    "total_spent": 6000,
                }
            return {
                "id": uuid.UUID(trip_id),
                "name": "Sylhet Trip",
                "creator_id": TRAVELER1_ID,
                "visibility": "PUBLIC",
                "status": "PLANNING",
                "destination_name": "Sylhet",
                "destination_image": "",
                "district": "Sylhet",
                "division": "Sylhet Division",
                "total_spent": 0,
            }

        # 5. Insert trip
        if "INSERT INTO trips" in query:
            trip_id = uuid.uuid4()
            record = {
                "id": trip_id,
                "creator_id": args[0],
                "destination_id": args[1],
                "name": args[2],
                "start_date": args[3],
                "end_date": args[4],
                "visibility": args[5],
                "status": args[6],
                "budget": args[7],
                "description": args[8],
                "created_at": datetime.now(timezone.utc),
            }
            self.trips[str(trip_id)] = record
            self.trip_members[(str(trip_id), str(args[0]))] = "OWNER"
            return record

        # 6. Group expedition insertion & status
        if "INSERT INTO groups" in query:
            group_id = uuid.uuid4()
            record = {
                "id": group_id,
                "trip_id": args[0],
                "organizer_id": args[1],
                "title": args[2],
                "capacity": args[3],
                "budget_per_person": args[4],
                "published": args[5],
                "created_at": datetime.now(timezone.utc),
            }
            self.groups[str(group_id)] = record
            self.group_members.add((str(group_id), str(args[1])))
            return record

        if "FROM groups" in query and ("WHERE id = $1" in query or "WHERE g.id = $1" in query):
            group_id = str(args[0])
            grp = self.groups.get(group_id)
            if grp:
                return dict(grp)
            return {
                "id": uuid.UUID(group_id),
                "organizer_id": TRAVELER1_ID,
                "title": "Sylhet Expedition",
                "capacity": 5,
                "members_count": 1,
            }

        # 7. Group member check & count
        if "FROM group_members WHERE group_id = $1 AND user_id = $2" in query:
            gid, uid = str(args[0]), str(args[1])
            if (gid, uid) in self.group_members:
                return {"user_id": args[1]}
            return None

        if "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2" in query:
            return {"exists": 1}

        if "FROM group_members WHERE group_id = $1" in query and "count(*)" in query:
            return {"member_count": len(self.group_members)}

        # 8. Applications
        if "INSERT INTO applications" in query:
            app_id = uuid.uuid4()
            record = {
                "id": app_id,
                "group_id": args[0],
                "applicant_id": args[1],
                "answers": json.loads(args[2]) if isinstance(args[2], str) else args[2],
                "status": "PENDING",
                "created_at": datetime.now(timezone.utc),
            }
            self.applications[str(app_id)] = record
            return record

        if "FROM applications" in query and ("WHERE a.id = $1" in query or "WHERE id = $1" in query or "a.id = $1" in query):
            app_id = str(args[0])
            record = self.applications.get(app_id, {})
            trip_id = list(self.trips.keys())[0] if self.trips else uuid.uuid4()
            group_id = record.get("group_id", uuid.uuid4())
            return {
                "id": uuid.UUID(app_id),
                "group_id": group_id,
                "applicant_id": record.get("applicant_id", TRAVELER2_ID),
                "organizer_id": TRAVELER1_ID,
                "capacity": 5,
                "status": record.get("status", "PENDING"),
                "trip_id": uuid.UUID(str(trip_id)),
                "group_title": "Sylhet Rain & River Expedition",
            }

        if "UPDATE applications SET status = $1" in query:
            app_id = str(args[1])
            new_status = args[0]
            if app_id in self.applications:
                self.applications[app_id]["status"] = new_status
            group_id = list(self.groups.keys())[0] if self.groups else uuid.uuid4()
            self.group_members.add((str(group_id), str(TRAVELER2_ID)))
            return {"id": uuid.UUID(app_id), "status": new_status}

        # 9. Workspace Elements: Itinerary, Expenses, Checklists, Notes, Map Places
        if "INSERT INTO trip_itinerary_items" in query:
            item_id = uuid.uuid4()
            record = {
                "id": item_id,
                "trip_id": args[0],
                "day_date": args[1],
                "title": args[2],
                "location": args[3],
                "notes": args[4],
                "sort_order": args[5],
            }
            self.itinerary[str(item_id)] = record
            return record

        if "INSERT INTO expenses" in query:
            exp_id = uuid.uuid4()
            record = {
                "id": exp_id,
                "trip_id": args[0],
                "paid_by": args[1],
                "title": args[2],
                "category": args[3],
                "amount": args[4],
                "expense_date": args[5],
                "created_at": datetime.now(timezone.utc),
            }
            self.expenses[str(exp_id)] = record
            return record

        if "INSERT INTO trip_checklists" in query:
            chk_id = uuid.uuid4()
            record = {
                "id": chk_id,
                "trip_id": args[0],
                "title": args[1],
                "created_by": args[2],
                "completed": False,
            }
            self.checklists[str(chk_id)] = record
            return record

        if "UPDATE trip_checklists" in query:
            chk_id = str(args[1])
            if chk_id in self.checklists:
                self.checklists[chk_id]["completed"] = args[0]
                return self.checklists[chk_id]
            return {"id": uuid.UUID(chk_id), "completed": args[0]}

        if "INSERT INTO trip_notes" in query:
            note_id = uuid.uuid4()
            record = {
                "id": note_id,
                "trip_id": args[0],
                "author_id": args[1],
                "body": args[2],
                "created_at": datetime.now(timezone.utc),
            }
            self.notes[str(note_id)] = record
            return record

        if "INSERT INTO trip_map_places" in query:
            place_id = uuid.uuid4()
            record = {
                "id": place_id,
                "trip_id": args[0],
                "name": args[1],
                "category": args[2],
                "notes": args[3],
                "lat": args[4],
                "lng": args[5],
            }
            self.places[str(place_id)] = record
            return record

        # 10. Group messages
        if "INSERT INTO group_messages" in query:
            msg_id = uuid.uuid4()
            record = {
                "id": msg_id,
                "group_id": args[0],
                "sender_id": args[1],
                "body": args[2],
                "created_at": datetime.now(timezone.utc),
            }
            self.messages.append(record)
            return record

        # 11. Tours & Departures & Bookings
        if "FROM destinations" in query and "WHERE id = $1" in query:
            dest_id = args[0]
            for d in self.destinations.values():
                if str(d["id"]) == str(dest_id):
                    return d
            return {"id": dest_id}

        if "INSERT INTO tours" in query:
            tour_id = uuid.uuid4()
            record = {
                "id": tour_id,
                "planner_id": args[0],
                "destination_id": args[1],
                "title": args[2],
                "description": args[3],
                "price": args[4],
                "capacity": args[5],
                "status": args[6],
                "created_at": datetime.now(timezone.utc),
            }
            self.tours[str(tour_id)] = record
            return record

        if "FROM tours" in query and "WHERE id = $1" in query:
            tour_id = str(args[0])
            return self.tours.get(tour_id, {"id": uuid.UUID(tour_id), "planner_id": PLANNER_ID})

        if "INSERT INTO tour_departures" in query:
            dep_id = uuid.uuid4()
            record = {
                "id": dep_id,
                "tour_id": args[0],
                "start_date": args[1],
                "end_date": args[2],
                "capacity": args[3],
                "status": args[4],
                "created_at": datetime.now(timezone.utc),
            }
            self.departures[str(dep_id)] = record
            return record

        if "FROM tour_departures" in query:
            dep_id = str(args[0])
            dep = self.departures.get(dep_id)
            if dep:
                return {
                    **dep,
                    "booked_seats": 0,
                    "tour_status": "PUBLISHED",
                    "tour_title": "Wild Chittagong Hill Tracts Traverse",
                    "price": 18500,
                    "planner_id": PLANNER_ID,
                }
            return {
                "id": uuid.UUID(dep_id),
                "capacity": 8,
                "booked_seats": 0,
                "status": "OPEN",
                "tour_status": "PUBLISHED",
                "price": 18500,
                "planner_id": PLANNER_ID,
            }

        if "FROM bookings" in query and "booked_count" in query:
            return {"booked_count": 0}

        if "INSERT INTO bookings" in query:
            book_id = uuid.uuid4()
            record = {
                "id": book_id,
                "departure_id": args[0],
                "traveler_id": args[1],
                "travelers_count": args[2],
                "status": args[3] if len(args) > 3 else "PENDING",
                "created_at": datetime.now(timezone.utc),
                "traveler_name": "Rafi Ahmed",
            }
            self.bookings[str(book_id)] = record
            return record

        # 12. Admin Analytics & Destination
        if "pending_verifications" in query or "count(*)::int FROM users" in query:
            return {
                "users": len(self.users),
                "planners": 1,
                "trips": len(self.trips) + 1,
                "active_groups": len(self.groups) + 1,
                "published_tours": len(self.tours) + 1,
                "reports": 0,
                "pending_verifications": 0,
            }

        if "INSERT INTO destinations" in query:
            dest_id = uuid.uuid4()
            record = {
                "id": dest_id,
                "name": args[0],
                "division": args[1],
                "district": args[2],
                "description": args[3],
                "category": args[4],
                "estimated_budget": args[5],
                "rating": 5.0,
            }
            self.destinations[dest_id] = record
            return record

        return None

    async def fetch(self, query: str, *args):
        # Destinations
        if "FROM destinations" in query:
            return list(self.destinations.values())

        # Trips list
        if "FROM trips t" in query:
            return list(self.trips.values())

        # Itinerary
        if "FROM trip_itinerary_items" in query:
            return list(self.itinerary.values())

        # Checklists
        if "FROM trip_checklists" in query:
            return list(self.checklists.values())

        # Notes
        if "FROM trip_notes" in query:
            return list(self.notes.values())

        # Photos
        if "FROM trip_photos" in query:
            return []

        # Members
        if "FROM trip_members" in query:
            return [
                {
                    "id": TRAVELER1_ID,
                    "user_id": TRAVELER1_ID,
                    "name": "Rafi Ahmed",
                    "email": "traveler@porikroma.com",
                    "role": "OWNER",
                    "joined_at": datetime.now(timezone.utc),
                    "avatar_url": "",
                }
            ]

        # Expenses
        if "FROM expenses" in query:
            return list(self.expenses.values())

        # Places
        if "FROM trip_map_places" in query:
            return list(self.places.values())

        # Applications
        if "FROM applications" in query:
            return list(self.applications.values())

        # Planner bookings
        if "FROM tour_bookings" in query or "FROM bookings" in query:
            return list(self.bookings.values())

        # Admin users list
        if "FROM users u" in query:
            return [
                {
                    "id": u["id"],
                    "name": u["name"],
                    "email": u["email"],
                    "role": u["role"],
                    "status": u["status"],
                    "created_at": u["created_at"],
                    "trips_count": 1,
                }
                for u in self.users.values()
            ]

        return []

    async def execute(self, query: str, *args):
        return "EXECUTE_OK"


@pytest.mark.anyio
async def test_full_multi_user_workflow_scenario():
    """
    PORT OF test_workflows.ts TO PYTEST:
    Executes the multi-user travel platform scenario through HTTPX (AsyncClient):
    1. Traveler 1 Login
    2. Traveler 1 Trip Creation
    3. Traveler 1 Expedition Publishing
    4. Traveler 1 Workspace Construction (Itinerary, Expense, Checklist, Note, Place)
    5. Traveler 2 Login
    6. Traveler 2 Expedition Application
    7. Traveler 1 Approves Application
    8. Traveler 2 Workspace Access & Group Chat
    9. Tour Planner Login, Tour & Departure Creation
    10. Traveler 1 Books Tour Departure
    11. Tour Planner Reviews Bookings
    12. Admin Analytics, Destination Creation & User Directory
    """
    # Check if a live PostgreSQL test database is available
    test_db_url = os.environ.get("TEST_DATABASE_URL")
    real_db_available = False

    if test_db_url:
        try:
            conn = await asyncpg.connect(test_db_url, timeout=2.0)
            await conn.close()
            real_db_available = True
        except Exception:
            real_db_available = False

    state_mock = StatefulWorkflowMock()

    # If no live database, install stateful workflow mock
    orig_fetchrow = db.fetchrow
    orig_fetch = db.fetch
    orig_execute = db.execute

    if not real_db_available:
        db.fetchrow = state_mock.fetchrow
        db.fetch = state_mock.fetch
        db.execute = state_mock.execute

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:

            # -------------------------------------------------------------
            # STEP 1: LOGIN AS TRAVELER 1 (Rafi Ahmed)
            # -------------------------------------------------------------
            res1 = await ac.post(
                "/api/auth/login",
                json={"email": "traveler@porikroma.com", "password": "password123"},
            )
            assert res1.status_code == 200, f"Step 1 failed: {res1.text}"
            data1 = res1.json()
            assert "token" in data1
            assert data1["user"]["email"] == "traveler@porikroma.com"
            t1_token = data1["token"]
            t1_headers = {"Authorization": f"Bearer {t1_token}"}

            # -------------------------------------------------------------
            # STEP 2: TRAVELER 1 CREATES TRIP
            # -------------------------------------------------------------
            res_dest = await ac.get("/api/destinations", headers=t1_headers)
            assert res_dest.status_code == 200
            destinations = res_dest.json()
            assert len(destinations) > 0
            sylhet = next((d for d in destinations if "Sylhet" in d["name"]), destinations[0])

            res_trip = await ac.post(
                "/api/trips",
                json={
                    "name": "Sylhet Rain & River Expedition",
                    "destinationId": sylhet["id"],
                    "startDate": "2025-07-10",
                    "endDate": "2025-07-14",
                    "budget": 35000,
                    "visibility": "PUBLIC",
                    "status": "PLANNING",
                    "description": "A 4-day shared journey through freshwater swamps and tea trails.",
                },
                headers=t1_headers,
            )
            assert res_trip.status_code == 201, f"Step 2 failed: {res_trip.text}"
            trip = res_trip.json()
            trip_id = trip["id"]
            assert trip["name"] == "Sylhet Rain & River Expedition"

            # -------------------------------------------------------------
            # STEP 3: TRAVELER 1 PUBLISHES GROUP EXPEDITION
            # -------------------------------------------------------------
            res_group = await ac.post(
                "/api/groups",
                json={
                    "tripId": trip_id,
                    "title": "Sylhet Rain & River Expedition",
                    "capacity": 5,
                    "budgetPerPerson": 7000,
                    "published": True,
                },
                headers=t1_headers,
            )
            assert res_group.status_code == 201, f"Step 3 failed: {res_group.text}"
            group = res_group.json()
            group_id = group["id"]
            assert group["capacity"] == 5

            # -------------------------------------------------------------
            # STEP 4: WORKSPACE ELEMENTS (ITINERARY, EXPENSE, CHECKLIST, NOTE, MAP)
            # -------------------------------------------------------------
            # Itinerary
            res_it = await ac.post(
                f"/api/trips/{trip_id}/itinerary",
                json={
                    "dayDate": "2025-07-10",
                    "title": "Arrival in Sylhet & Lalakhal Boat Ride",
                    "location": "Lalakhal River",
                    "notes": "Emerald waters boat tour at sunset.",
                },
                headers=t1_headers,
            )
            assert res_it.status_code == 201, f"Step 4 Itinerary failed: {res_it.text}"
            it_data = res_it.json()
            assert it_data["title"] == "Arrival in Sylhet & Lalakhal Boat Ride"

            # Expense
            res_exp = await ac.post(
                "/api/expenses",
                json={
                    "tripId": trip_id,
                    "title": "Eco-cottage stay deposit",
                    "category": "Stay",
                    "amount": 6000,
                    "expenseDate": "2025-07-10",
                },
                headers=t1_headers,
            )
            assert res_exp.status_code == 201, f"Step 4 Expense failed: {res_exp.text}"
            assert res_exp.json()["amount"] == 6000

            # Checklist
            res_chk = await ac.post(
                f"/api/trips/{trip_id}/checklist",
                json={"title": "Rain poncho and dry bag"},
                headers=t1_headers,
            )
            assert res_chk.status_code == 201, f"Step 4 Checklist failed: {res_chk.text}"
            chk_id = res_chk.json()["id"]

            res_chk_toggle = await ac.patch(
                f"/api/trips/{trip_id}/checklist/{chk_id}",
                json={"completed": True},
                headers=t1_headers,
            )
            assert res_chk_toggle.status_code == 200
            assert res_chk_toggle.json()["completed"] is True

            # Note
            res_note = await ac.post(
                f"/api/trips/{trip_id}/notes",
                json={"body": "Remember to try seven-layer tea at Nilkantha tea cabin."},
                headers=t1_headers,
            )
            assert res_note.status_code == 201
            assert "seven-layer tea" in res_note.json()["body"]

            # Map Place
            res_place = await ac.post(
                f"/api/trips/{trip_id}/map-places",
                json={
                    "name": "Lalakhal River Basin",
                    "category": "Nature",
                    "notes": "Best emerald reflections at 4 PM",
                },
                headers=t1_headers,
            )
            assert res_place.status_code == 201
            assert res_place.json()["name"] == "Lalakhal River Basin"

            # -------------------------------------------------------------
            # STEP 5: LOGIN AS TRAVELER 2 (Samira Rahman)
            # -------------------------------------------------------------
            res_t2 = await ac.post(
                "/api/auth/login",
                json={"email": "traveler2@porikroma.com", "password": "password123"},
            )
            assert res_t2.status_code == 200, f"Step 5 Login failed: {res_t2.text}"
            t2_token = res_t2.json()["token"]
            t2_headers = {"Authorization": f"Bearer {t2_token}"}

            # -------------------------------------------------------------
            # STEP 6: TRAVELER 2 APPLIES TO JOIN EXPEDITION
            # -------------------------------------------------------------
            res_app = await ac.post(
                f"/api/groups/{group_id}/applications",
                json={
                    "experience": "Hiked in Sreemangal before. Comfortable on boats.",
                    "dietary": "No restrictions",
                    "commitment": "Yes, full dates committed.",
                },
                headers=t2_headers,
            )
            assert res_app.status_code == 201, f"Step 6 Application failed: {res_app.text}"
            app_data = res_app.json()
            app_id = app_data["id"]
            assert app_data["status"] == "PENDING"

            # -------------------------------------------------------------
            # STEP 7: TRAVELER 1 APPROVES APPLICATION
            # -------------------------------------------------------------
            res_app_approve = await ac.patch(
                f"/api/applications/{app_id}/status",
                json={"status": "APPROVED"},
                headers=t1_headers,
            )
            assert res_app_approve.status_code == 200, f"Step 7 Approval failed: {res_app_approve.text}"
            assert res_app_approve.json()["status"] == "APPROVED"

            # -------------------------------------------------------------
            # STEP 8: TRAVELER 2 ACCESSES WORKSPACE AND SENDS CHAT MESSAGE
            # -------------------------------------------------------------
            res_ws = await ac.get(f"/api/trips/{trip_id}/workspace", headers=t2_headers)
            assert res_ws.status_code == 200, f"Step 8 Workspace failed: {res_ws.text}"
            ws_data = res_ws.json()
            assert "itinerary" in ws_data
            assert "checklist" in ws_data
            assert "expenses" in ws_data

            res_chat = await ac.post(
                f"/api/groups/{group_id}/messages",
                json={"body": "Hi Rafi! Excited to join this Sylhet trip."},
                headers=t2_headers,
            )
            assert res_chat.status_code == 201, f"Step 8 Chat failed: {res_chat.text}"
            assert res_chat.json()["body"] == "Hi Rafi! Excited to join this Sylhet trip."

            # -------------------------------------------------------------
            # STEP 9: TOUR PLANNER CREATES TOUR & SCHEDULES DEPARTURE
            # -------------------------------------------------------------
            res_p_login = await ac.post(
                "/api/auth/login",
                json={"email": "planner@porikroma.com", "password": "password123"},
            )
            assert res_p_login.status_code == 200, f"Step 9 Planner Login failed: {res_p_login.text}"
            p_token = res_p_login.json()["token"]
            p_headers = {"Authorization": f"Bearer {p_token}"}

            res_tour = await ac.post(
                "/api/tours",
                json={
                    "destinationId": destinations[0]["id"],
                    "title": "Wild Chittagong Hill Tracts Traverse",
                    "description": "Exclusive 5-day mountain traverse with indigenous guides.",
                    "price": 18500,
                    "capacity": 8,
                    "status": "PUBLISHED",
                },
                headers=p_headers,
            )
            assert res_tour.status_code == 201, f"Step 9 Tour Creation failed: {res_tour.text}"
            tour_id = res_tour.json()["id"]

            res_dep = await ac.post(
                f"/api/tours/{tour_id}/departures",
                json={
                    "startDate": "2025-11-05",
                    "endDate": "2025-11-10",
                    "capacity": 8,
                    "status": "OPEN",
                },
                headers=p_headers,
            )
            assert res_dep.status_code == 201, f"Step 9 Departure failed: {res_dep.text}"
            dep_id = res_dep.json()["id"]

            # -------------------------------------------------------------
            # STEP 10: TRAVELER 1 BOOKS TOUR DEPARTURE
            # -------------------------------------------------------------
            res_book = await ac.post(
                f"/api/departures/{dep_id}/bookings",
                json={"travelersCount": 2},
                headers=t1_headers,
            )
            assert res_book.status_code == 201, f"Step 10 Booking failed: {res_book.text}"
            booking_id = res_book.json()["id"]

            # -------------------------------------------------------------
            # STEP 11: TOUR PLANNER VIEWS BOOKINGS
            # -------------------------------------------------------------
            res_p_bookings = await ac.get("/api/planner/bookings", headers=p_headers)
            assert res_p_bookings.status_code == 200, f"Step 11 Bookings failed: {res_p_bookings.text}"
            p_bookings = res_p_bookings.json()
            assert any(str(b["id"]) == str(booking_id) for b in p_bookings)

            # -------------------------------------------------------------
            # STEP 12: ADMIN ANALYTICS, DESTINATION CREATION & USERS LIST
            # -------------------------------------------------------------
            res_admin_login = await ac.post(
                "/api/auth/login",
                json={"email": "admin@porikroma.com", "password": "password123"},
            )
            assert res_admin_login.status_code == 200, f"Step 12 Admin Login failed: {res_admin_login.text}"
            admin_token = res_admin_login.json()["token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            # Analytics
            res_analytics = await ac.get("/api/admin/analytics", headers=admin_headers)
            assert res_analytics.status_code == 200
            analytics = res_analytics.json()
            assert "users" in analytics
            assert "trips" in analytics
            assert "active_groups" in analytics

            # Admin creates new destination
            res_new_dest = await ac.post(
                "/api/destinations",
                json={
                    "name": "Kuakata Sunset Beach",
                    "division": "Barishal Division",
                    "district": "Patuakhali",
                    "description": "Panoramic sea beach where both sunrise and sunset can be viewed.",
                    "category": "Beach",
                    "estimatedBudget": 8500,
                },
                headers=admin_headers,
            )
            assert res_new_dest.status_code == 201, f"Step 12 Destination failed: {res_new_dest.text}"
            assert res_new_dest.json()["name"] == "Kuakata Sunset Beach"

            # Admin reviews user directory
            res_users = await ac.get("/api/admin/users", headers=admin_headers)
            assert res_users.status_code == 200, f"Step 12 Users failed: {res_users.text}"
            users_list = res_users.json()
            assert len(users_list) >= 4

    finally:
        # Restore db methods
        db.fetchrow = orig_fetchrow
        db.fetch = orig_fetch
        db.execute = orig_execute
