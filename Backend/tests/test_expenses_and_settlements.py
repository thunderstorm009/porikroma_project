from datetime import date, datetime
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


USER_1_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_2_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
USER_3_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

TRIP_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
EXPENSE_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")
SETTLEMENT_ID = uuid.UUID("66666666-6666-6666-6666-666666666666")

MOCK_USER_1 = {
    "id": USER_1_ID,
    "email": "traveler1@porikroma.com",
    "name": "Rafi Ahmed",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_USER_2 = {
    "id": USER_2_ID,
    "email": "traveler2@porikroma.com",
    "name": "Samira Rahman",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_EXPENSES_LIST = [
    {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "paid_by": USER_1_ID,
        "title": "Resort booking deposit",
        "category": "Stay",
        "amount": 14500,
        "expense_date": date(2025, 5, 18),
        "trip_name": "Cox's Bazar Escape",
        "paid_by_name": "Rafi Ahmed",
    },
    {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "paid_by": USER_1_ID,
        "title": "Private vehicle transfer from airport",
        "category": "Transport",
        "amount": 3500,
        "expense_date": date(2025, 5, 18),
        "trip_name": "Cox's Bazar Escape",
        "paid_by_name": "Rafi Ahmed",
    },
    {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "paid_by": USER_2_ID,
        "title": "Dinner at Salt & Pepper",
        "category": "Food & drink",
        "amount": 3200,
        "expense_date": date(2025, 5, 19),
        "trip_name": "Cox's Bazar Escape",
        "paid_by_name": "Samira Rahman",
    },
    {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "paid_by": USER_1_ID,
        "title": "Inani open-hood jeep hire",
        "category": "Activities",
        "amount": 2500,
        "expense_date": date(2025, 5, 20),
        "trip_name": "Cox's Bazar Escape",
        "paid_by_name": "Rafi Ahmed",
    },
    {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "paid_by": USER_1_ID,
        "title": "Beachside coffee and coconuts",
        "category": "Food & drink",
        "amount": 800,
        "expense_date": date(2025, 5, 20),
        "trip_name": "Cox's Bazar Escape",
        "paid_by_name": "Rafi Ahmed",
    },
]


def make_auth_header(user_id: uuid.UUID, email: str, role: str) -> dict:
    token = create_access_token({"id": str(user_id), "email": email, "role": role})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. EXPENSES OVERVIEW RESPONSE SHAPE & TOTALS (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_expenses_overview_response_shape(client: TestClient):
    """
    CHECKLIST TEST:
    /api/expenses/overview matches the old response shape with BDT totals & categories.
    """
    auth_header = make_auth_header(USER_1_ID, "traveler1@porikroma.com", "TRAVELER")

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        # fetchrow: 1: auth user, 2: budget query
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            {"total_budget": 60700},
        ]
        mock_fetch.return_value = MOCK_EXPENSES_LIST

        res = client.get("/api/expenses/overview", headers=auth_header)
        assert res.status_code == 200
        data = res.json()

        # Validate exact response shape matching legacy Fastify backend
        assert "expenses" in data
        assert "totalSpent" in data
        assert "totalBudget" in data
        assert "categories" in data

        # Check total spent calculation: 14500 + 3500 + 3200 + 2500 + 800 = 24500 BDT
        assert data["totalSpent"] == 24500
        assert data["totalBudget"] == 60700

        # Check category breakdowns
        categories = data["categories"]
        assert categories["Stay"] == 14500
        assert categories["Transport"] == 3500
        assert categories["Activities"] == 2500
        assert categories["Food & drink"] == 4000  # 3200 + 800


# ---------------------------------------------------------------------------
# 2. SPLIT AMOUNTS & ROUNDING LOGIC (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_split_amounts_and_rounding(client: TestClient):
    """
    CHECKLIST TEST:
    Split amounts and settlement totals match the old backend for the same input.
    """
    auth_u2 = make_auth_header(USER_2_ID, "traveler2@porikroma.com", "TRAVELER")

    # 2a. Even split: 3200 BDT split across 2 members -> 1600 BDT each
    mock_members = [{"user_id": USER_1_ID}, {"user_id": USER_2_ID}]
    mock_inserted = {
        "id": EXPENSE_ID,
        "trip_id": TRIP_ID,
        "paid_by": USER_2_ID,
        "title": "Dinner at Salt & Pepper",
        "category": "Food & drink",
        "amount": 3200,
        "expense_date": date(2025, 5, 19),
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        # fetchrow: 1: auth, 2: insert expense, 3: trip creator lookup for notification
        mock_fetchrow.side_effect = [
            MOCK_USER_2,
            mock_inserted,
            {"creator_id": USER_1_ID, "name": "Cox's Bazar Escape"},
        ]
        mock_fetch.return_value = mock_members

        payload = {
            "tripId": str(TRIP_ID),
            "title": "Dinner at Salt & Pepper",
            "category": "Food & drink",
            "amount": 3200,
            "expenseDate": "2025-05-19",
        }
        res = client.post("/api/expenses", json=payload, headers=auth_u2)
        assert res.status_code == 201
        data = res.json()
        assert data["amount"] == 3200

        # Check splits written to DB: 2 calls to insert into expense_splits with amount=1600
        split_calls = [
            call for call in mock_execute.await_args_list
            if "INSERT INTO expense_splits" in call[0][0]
        ]
        assert len(split_calls) == 2
        # Both members must receive exactly 1600 BDT
        assert split_calls[0][0][3] == 1600
        assert split_calls[1][0][3] == 1600

    # 2b. Uneven split with remainder: 1000 BDT across 3 members -> 334, 333, 333 (sum=1000)
    mock_3_members = [{"user_id": USER_1_ID}, {"user_id": USER_2_ID}, {"user_id": USER_3_ID}]
    mock_inserted_uneven = {
        "id": uuid.uuid4(),
        "trip_id": TRIP_ID,
        "paid_by": USER_1_ID,
        "title": "Street snack sharing",
        "category": "Food & drink",
        "amount": 1000,
        "expense_date": date(2025, 5, 19),
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.side_effect = [
            MOCK_USER_1,
            mock_inserted_uneven,
            {"creator_id": USER_1_ID, "name": "Cox's Bazar Escape"},
        ]
        mock_fetch.return_value = mock_3_members

        res_uneven = client.post(
            "/api/expenses",
            json={"tripId": str(TRIP_ID), "title": "Street snack sharing", "category": "Food & drink", "amount": 1000},
            headers=make_auth_header(USER_1_ID, "traveler1@porikroma.com", "TRAVELER"),
        )
        assert res_uneven.status_code == 201

        uneven_split_calls = [
            call for call in mock_execute.await_args_list
            if "INSERT INTO expense_splits" in call[0][0]
        ]
        assert len(uneven_split_calls) == 3
        amounts = [c[0][3] for c in uneven_split_calls]
        assert sum(amounts) == 1000
        assert sorted(amounts) == [333, 333, 334]


# ---------------------------------------------------------------------------
# 3. SETTLEMENTS CRUD & STATUS TRANSITIONS
# ---------------------------------------------------------------------------
def test_settlements_flow(client: TestClient):
    auth_header = make_auth_header(USER_2_ID, "traveler2@porikroma.com", "TRAVELER")

    mock_settlement = {
        "id": SETTLEMENT_ID,
        "trip_id": TRIP_ID,
        "from_user_id": USER_2_ID,
        "to_user_id": USER_1_ID,
        "amount": 1600,
        "status": "PAID",
        "from_user_name": "Samira Rahman",
        "to_user_name": "Rafi Ahmed",
        "created_at": datetime(2025, 5, 20, 10, 0),
    }

    # 3a. Create settlement
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_2,
            mock_settlement,
        ]
        res = client.post(
            f"/api/trips/{TRIP_ID}/settlements",
            json={"toUserId": str(USER_1_ID), "amount": 1600},
            headers=auth_header,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["amount"] == 1600
        assert data["status"] == "PAID"

    # 3b. List settlements
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER_2
        mock_fetch.return_value = [mock_settlement]

        res_list = client.get(f"/api/trips/{TRIP_ID}/settlements", headers=auth_header)
        assert res_list.status_code == 200
        items = res_list.json()
        assert len(items) == 1
        assert items[0]["from_user_name"] == "Samira Rahman"
        assert items[0]["amount"] == 1600

    # 3c. Update settlement status
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        mock_fetchrow.side_effect = [
            MOCK_USER_2,
            {**mock_settlement, "status": "CANCELLED"},
        ]
        res_patch = client.patch(
            f"/api/settlements/{SETTLEMENT_ID}/status",
            json={"status": "CANCELLED"},
            headers=auth_header,
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["status"] == "CANCELLED"


# ---------------------------------------------------------------------------
# 4. TRIP EXPENSES LIST & DELETE
# ---------------------------------------------------------------------------
def test_list_and_delete_expense(client: TestClient):
    auth_header = make_auth_header(USER_1_ID, "traveler1@porikroma.com", "TRAVELER")

    # List trip expenses
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:
        mock_fetchrow.return_value = MOCK_USER_1
        mock_fetch.return_value = MOCK_EXPENSES_LIST[:2]

        res = client.get(f"/api/trips/{TRIP_ID}/expenses", headers=auth_header)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 2
        assert items[0]["title"] == "Resort booking deposit"

    # Delete expense
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_execute:
        mock_fetchrow.return_value = MOCK_USER_1
        res_del = client.delete(f"/api/expenses/{EXPENSE_ID}", headers=auth_header)
        assert res_del.status_code == 200
        assert res_del.json() == {"success": True}
        mock_execute.assert_awaited_with("DELETE FROM expenses WHERE id = $1", EXPENSE_ID)
