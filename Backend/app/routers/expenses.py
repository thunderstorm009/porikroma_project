from datetime import date, datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.expenses import (
    ExpenseCreateRequest,
    SettlementCreateRequest,
    SettlementStatusUpdateRequest,
)
from app.serializers import record_to_dict

router = APIRouter(tags=["Expenses & Settlements"])


def parse_date(val: Optional[str]) -> Optional[date]:
    """Parse string to Python date object safely for asyncpg."""
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


# -------------------------------------------------------------
# 1. EXPENSES OVERVIEW
# -------------------------------------------------------------
@router.get("/api/expenses/overview")
async def get_expenses_overview(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Cross-trip expense ledger with category sums and total budget usage."""
    curr_uuid = uuid.UUID(str(current_user["id"]))
    query = """
        SELECT e.*, t.name AS trip_name, u.name AS paid_by_name
        FROM expenses e
        JOIN trips t ON t.id = e.trip_id
        JOIN users u ON u.id = e.paid_by
        WHERE t.creator_id = $1 OR e.paid_by = $1
        ORDER BY e.expense_date DESC
    """
    rows = await db.fetch(query, curr_uuid)
    expenses = [record_to_dict(r) for r in rows]

    total_spent = sum(item.get("amount", 0) for item in expenses)
    categories = {}
    for item in expenses:
        cat = item.get("category", "Other")
        categories[cat] = categories.get(cat, 0) + item.get("amount", 0)

    # Calculate planned budget target across trips
    budget_row = await db.fetchrow(
        "SELECT coalesce(sum(budget)::int, 60700) AS total_budget FROM trips WHERE creator_id = $1",
        curr_uuid,
    )
    total_budget = budget_row["total_budget"] if budget_row and budget_row["total_budget"] else 60700

    return {
        "expenses": expenses,
        "totalSpent": total_spent,
        "totalBudget": total_budget,
        "categories": categories,
    }


# -------------------------------------------------------------
# 2. TRIP EXPENSES CRUD & SPLITS
# -------------------------------------------------------------
@router.get("/api/trips/{id}/expenses")
async def list_trip_expenses(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List expenses recorded for a specific trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    query = """
        SELECT e.*, u.name AS paid_by_name
        FROM expenses e
        JOIN users u ON u.id = e.paid_by
        WHERE e.trip_id = $1
        ORDER BY e.expense_date DESC
    """
    rows = await db.fetch(query, t_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/api/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Record new trip expense, distribute split among trip members, and return record."""
    try:
        t_uuid = uuid.UUID(data.tripId)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid trip ID"})

    exp_date = parse_date(data.expenseDate)

    query = """
        INSERT INTO expenses (trip_id, paid_by, title, category, amount, expense_date)
        VALUES ($1, $2, $3, $4, $5, coalesce($6, CURRENT_DATE))
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        t_uuid,
        u_uuid,
        data.title,
        data.category,
        data.amount,
        exp_date,
    )
    expense = record_to_dict(row)
    e_uuid = uuid.UUID(expense["id"])

    # Splitting logic: distribute amount equally in BDT across trip members
    members = await db.fetch("SELECT user_id FROM trip_members WHERE trip_id = $1", t_uuid)
    if not members:
        members = [{"user_id": u_uuid}]

    count = len(members)
    share = data.amount // count
    remainder = data.amount % count

    for idx, m in enumerate(members):
        m_share = share + (1 if idx < remainder else 0)
        await db.execute(
            """
            INSERT INTO expense_splits (expense_id, user_id, amount, settled)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (expense_id, user_id)
            DO UPDATE SET amount = EXCLUDED.amount
            """,
            e_uuid,
            m["user_id"],
            m_share,
            (m["user_id"] == u_uuid),
        )

    # Notify trip creator if someone else paid
    trip = await db.fetchrow("SELECT creator_id, name FROM trips WHERE id = $1", t_uuid)
    if trip and str(trip["creator_id"]) != str(u_uuid):
        await db.execute(
            "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
            trip["creator_id"],
            "EXPENSE_ADDED",
            f'{current_user.get("name", "Traveler")} added "{data.title}" (৳{data.amount:,}) to {trip["name"]}',
            f"/trips/{data.tripId}",
        )

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=expense)


@router.delete("/api/expenses/{id}")
async def delete_expense(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete an expense record."""
    try:
        e_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Expense not found"})

    await db.execute("DELETE FROM expenses WHERE id = $1", e_uuid)
    return {"success": True}


# -------------------------------------------------------------
# 3. SETTLEMENTS & BALANCES
# -------------------------------------------------------------
@router.get("/api/trips/{id}/settlements")
async def list_trip_settlements(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List recorded payment settlements between participants."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    query = """
        SELECT s.*, u1.name AS from_user_name, u2.name AS to_user_name
        FROM expense_settlements s
        JOIN users u1 ON u1.id = s.from_user_id
        JOIN users u2 ON u2.id = s.to_user_id
        WHERE s.trip_id = $1
        ORDER BY s.created_at DESC
    """
    rows = await db.fetch(query, t_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/api/trips/{id}/settlements", status_code=status.HTTP_201_CREATED)
async def create_trip_settlement(
    id: str,
    data: SettlementCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Record a payment settlement from current user to another participant."""
    try:
        t_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
        to_uuid = uuid.UUID(data.toUserId)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid settlement parameters"})

    if u_uuid == to_uuid:
        return JSONResponse(status_code=400, content={"error": "Cannot settle with yourself"})

    query = """
        INSERT INTO expense_settlements (trip_id, from_user_id, to_user_id, amount, status)
        VALUES ($1, $2, $3, $4, 'PAID')
        RETURNING *
    """
    row = await db.fetchrow(query, t_uuid, u_uuid, to_uuid, data.amount)
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@router.patch("/api/settlements/{id}/status")
async def update_settlement_status(
    id: str,
    data: SettlementStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update payment status of a settlement (PENDING, PAID, CANCELLED)."""
    try:
        s_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Settlement not found"})

    row = await db.fetchrow(
        "UPDATE expense_settlements SET status = $1 WHERE id = $2 RETURNING *",
        data.status,
        s_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Settlement not found"})
    return record_to_dict(row)


# -------------------------------------------------------------
# 4. EXPENSE SPLITS BREAKDOWN
# -------------------------------------------------------------
@router.get("/api/expenses/{id}/splits")
async def get_expense_splits(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve participant split amounts for a specific expense."""
    try:
        e_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Expense not found"})

    query = """
        SELECT es.*, u.name AS user_name, u.email AS user_email
        FROM expense_splits es
        JOIN users u ON u.id = es.user_id
        WHERE es.expense_id = $1
    """
    rows = await db.fetch(query, e_uuid)
    return [record_to_dict(r) for r in rows]


@router.get("/api/trips/{id}/splits")
async def list_trip_splits(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve all expense splits across a trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    query = """
        SELECT es.*, e.title AS expense_title, e.category, e.paid_by, u.name AS user_name
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        JOIN users u ON u.id = es.user_id
        WHERE e.trip_id = $1
    """
    rows = await db.fetch(query, t_uuid)
    return [record_to_dict(r) for r in rows]
