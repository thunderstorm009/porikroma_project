from datetime import date, datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
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


class AnnualBudgetRequest(BaseModel):
    year: int = Field(ge=2000, le=2200)
    amount: int = Field(ge=0)


@router.get("/api/expenses/annual-budget")
async def get_annual_budget(current_user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    user_uuid = uuid.UUID(str(current_user["id"]))
    year = date.today().year
    row = await db.fetchrow("SELECT amount FROM annual_travel_budgets WHERE user_id = $1 AND budget_year = $2", user_uuid, year)
    return {"year": year, "amount": row["amount"] if row else 0}


@router.put("/api/expenses/annual-budget")
async def set_annual_budget(data: AnnualBudgetRequest, current_user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        """INSERT INTO annual_travel_budgets (user_id, budget_year, amount) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, budget_year) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()
           RETURNING budget_year AS year, amount""",
        user_uuid, data.year, data.amount,
    )
    return record_to_dict(row)


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
    """Cross-trip expense ledger with category sums, budget usage, and settlement statuses."""
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

    # Settlement totals across user's trips reflecting PENDING, PAID, and CONFIRMED statuses
    settlement_query = """
        SELECT s.*, t.name AS trip_name,
               u1.name AS from_user_name, u2.name AS to_user_name
        FROM expense_settlements s
        JOIN trips t ON t.id = s.trip_id
        JOIN users u1 ON u1.id = s.from_user_id
        JOIN users u2 ON u2.id = s.to_user_id
        WHERE s.from_user_id = $1 OR s.to_user_id = $1
        ORDER BY s.created_at DESC
    """
    settlement_rows = await db.fetch(settlement_query, curr_uuid)
    settlements = [record_to_dict(r) for r in settlement_rows]

    total_settled = sum(
        s.get("amount", 0) for s in settlements
        if str(s.get("status", "")).upper() == "CONFIRMED"
    )
    total_outstanding = sum(
        s.get("amount", 0) for s in settlements
        if str(s.get("status", "")).upper() in ("PENDING", "PAID")
    )
    settlements_summary = {
        "settled": total_settled,
        "outstanding": total_outstanding,
        "pending": sum(s.get("amount", 0) for s in settlements if str(s.get("status", "")).upper() == "PENDING"),
        "paid": sum(s.get("amount", 0) for s in settlements if str(s.get("status", "")).upper() == "PAID"),
        "confirmed": total_settled,
    }

    return {
        "expenses": expenses,
        "totalSpent": total_spent,
        "totalBudget": total_budget,
        "categories": categories,
        "settlements": settlements,
        "totalSettled": total_settled,
        "totalOutstanding": total_outstanding,
        "settlementsSummary": settlements_summary,
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

    target_status = "PENDING"
    if data.status and data.status.strip().upper() in ("PENDING", "PAID", "CONFIRMED"):
        target_status = data.status.strip().upper()

    query = """
        INSERT INTO expense_settlements (trip_id, from_user_id, to_user_id, amount, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """
    row = await db.fetchrow(query, t_uuid, u_uuid, to_uuid, data.amount, target_status)
    settlement_dict = record_to_dict(row)

    # Notify creditor of new settlement
    try:
        trip = await db.fetchrow("SELECT name FROM trips WHERE id = $1", t_uuid)
        trip_name = trip["name"] if trip else "expedition"
        payer_name = current_user.get("name", "A traveler")
        msg = (
            f"{payer_name} recorded a settlement of ৳{data.amount:,} as paid for {trip_name}. Please confirm receipt."
            if target_status == "PAID"
            else f"{payer_name} recorded a pending settlement of ৳{data.amount:,} for {trip_name}."
        )
        await db.execute(
            """
            INSERT INTO notifications (user_id, type, detail, link)
            VALUES ($1, $2, $3, $4)
            """,
            to_uuid,
            "SETTLEMENT_RECORDED",
            msg,
            f"/trips/{id}/expenses",
        )
    except Exception:
        pass

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=settlement_dict)


async def perform_settlement_transition(
    s_uuid: uuid.UUID,
    target_status: str,
    current_user: dict,
    db: Database,
) -> tuple[Optional[dict], Optional[dict], int]:
    """Execute status transition on expense_settlements with permission and workflow validation.
    Returns (result_dict, error_dict, status_code).
    """
    target_status = target_status.strip().upper()
    if target_status not in ("PENDING", "PAID", "CONFIRMED", "CANCELLED"):
        return None, {"error": f"Invalid settlement status: {target_status}"}, 400

    settlement = await db.fetchrow(
        """
        SELECT s.*, t.name AS trip_name,
               u1.name AS from_user_name, u2.name AS to_user_name
        FROM expense_settlements s
        JOIN trips t ON t.id = s.trip_id
        JOIN users u1 ON u1.id = s.from_user_id
        JOIN users u2 ON u2.id = s.to_user_id
        WHERE s.id = $1
        """,
        s_uuid,
    )
    if not settlement:
        return None, {"error": "Settlement not found"}, 404

    curr_id = str(current_user["id"])
    from_id = str(settlement["from_user_id"])
    to_id = str(settlement["to_user_id"])
    is_debtor = (curr_id == from_id)
    is_creditor = (curr_id == to_id)
    is_admin = (current_user.get("role") == "ADMIN")

    if not is_debtor and not is_creditor and not is_admin:
        return None, {"error": "You are not authorized to update this settlement"}, 403

    current_status = str(settlement["status"]).upper()

    # Idempotent: already at requested status
    if current_status == target_status:
        return record_to_dict(settlement), None, 200

    # Cannot transition out of CONFIRMED
    if current_status == "CONFIRMED":
        return None, {"error": "Settlement is already confirmed"}, 400

    # Transition 1: Mark as PAID (debtor action)
    if target_status == "PAID":
        if not is_debtor and not is_admin:
            return None, {"error": "Only the debtor can mark a settlement as paid"}, 403
        if current_status != "PENDING":
            return None, {"error": f"Cannot mark as paid from status {current_status}"}, 400

        row = await db.fetchrow(
            "UPDATE expense_settlements SET status = 'PAID' WHERE id = $1 RETURNING *",
            s_uuid,
        )
        try:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                settlement["to_user_id"],
                "SETTLEMENT_PAID",
                f"{settlement['from_user_name']} marked settlement of ৳{settlement['amount']:,} as paid for {settlement['trip_name']}. Please confirm receipt.",
                f"/trips/{settlement['trip_id']}/expenses",
            )
        except Exception:
            pass
        return (record_to_dict(row) if row else {**record_to_dict(settlement), "status": "PAID"}), None, 200

    # Transition 2: Confirm received (creditor action)
    if target_status == "CONFIRMED":
        if not is_creditor and not is_admin:
            return None, {"error": "Only the creditor can confirm receipt of a settlement"}, 403
        if current_status == "PENDING":
            return None, {"error": "Invalid transition: debtor must mark settlement as paid before confirmation"}, 400
        if current_status != "PAID":
            return None, {"error": f"Cannot confirm settlement from status {current_status}"}, 400

        row = await db.fetchrow(
            "UPDATE expense_settlements SET status = 'CONFIRMED', settled_at = now() WHERE id = $1 RETURNING *",
            s_uuid,
        )
        try:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                settlement["from_user_id"],
                "SETTLEMENT_CONFIRMED",
                f"{settlement['to_user_name']} confirmed receipt of ৳{settlement['amount']:,} for {settlement['trip_name']}. Settlement completed!",
                f"/trips/{settlement['trip_id']}/expenses",
            )
        except Exception:
            pass
        return (record_to_dict(row) if row else {**record_to_dict(settlement), "status": "CONFIRMED", "settled_at": datetime.now()}), None, 200

    # Transition 3: CANCELLED
    if target_status == "CANCELLED":
        row = await db.fetchrow(
            "UPDATE expense_settlements SET status = 'CANCELLED' WHERE id = $1 RETURNING *",
            s_uuid,
        )
        other_party = settlement["to_user_id"] if is_debtor else settlement["from_user_id"]
        actor_name = settlement["from_user_name"] if is_debtor else settlement["to_user_name"]
        try:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                other_party,
                "SETTLEMENT_CANCELLED",
                f"{actor_name} cancelled settlement of ৳{settlement['amount']:,} for {settlement['trip_name']}.",
                f"/trips/{settlement['trip_id']}/expenses",
            )
        except Exception:
            pass
        return (record_to_dict(row) if row else {**record_to_dict(settlement), "status": "CANCELLED"}), None, 200

    return None, {"error": f"Cannot transition settlement from {current_status} to {target_status}"}, 400


@router.patch("/api/settlements/{id}/status")
async def update_settlement_status(
    id: str,
    data: SettlementStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update payment status of a settlement with permission and workflow enforcement."""
    try:
        s_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Settlement not found"})

    result, err, code = await perform_settlement_transition(s_uuid, data.status, current_user, db)
    if err:
        return JSONResponse(status_code=code, content=err)
    return result


@router.post("/api/settlements/{id}/pay")
async def mark_settlement_as_paid(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Debtor marks a settlement as paid."""
    try:
        s_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Settlement not found"})

    result, err, code = await perform_settlement_transition(s_uuid, "PAID", current_user, db)
    if err:
        return JSONResponse(status_code=code, content=err)
    return result


@router.post("/api/settlements/{id}/confirm")
async def confirm_settlement_received(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Creditor confirms receipt of payment for a settlement."""
    try:
        s_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Settlement not found"})

    result, err, code = await perform_settlement_transition(s_uuid, "CONFIRMED", current_user, db)
    if err:
        return JSONResponse(status_code=code, content=err)
    return result



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
