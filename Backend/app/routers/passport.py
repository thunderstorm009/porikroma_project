from datetime import date, datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.passport import PassportEntryCreateRequest
from app.serializers import record_to_dict

router = APIRouter(tags=["Passport, Footprint & Achievements"])


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


async def evaluate_user_achievements(user_id: uuid.UUID, db: Database) -> List[str]:
    """Evaluate milestone achievements and award badges to user in user_achievements."""
    unlocked_codes = []

    # 1. Total destinations stamped & distinct districts visited
    dest_stats = await db.fetchrow(
        """
        SELECT count(*)::int AS total_stamps,
               count(DISTINCT d.district)::int AS total_districts
        FROM passport_entries p
        JOIN destinations d ON d.id = p.destination_id
        WHERE p.user_id = $1
        """,
        user_id,
    )
    total_stamps = dest_stats["total_stamps"] if dest_stats else 0
    total_districts = dest_stats["total_districts"] if dest_stats else 0

    if total_stamps >= 1:
        unlocked_codes.append("FIRST_DESTINATION")
    if total_districts >= 5:
        unlocked_codes.append("FIVE_DISTRICTS")
    if total_districts >= 10:
        unlocked_codes.append("TEN_DISTRICTS")

    # 2. Group expedition participation
    group_member = await db.fetchrow(
        "SELECT 1 FROM group_members WHERE user_id = $1 LIMIT 1",
        user_id,
    )
    if group_member:
        unlocked_codes.append("GROUP_EXPEDITION")

    # 3. Travel writer (has written trip notes or memories)
    has_notes = await db.fetchrow(
        "SELECT 1 FROM trip_notes WHERE author_id = $1 LIMIT 1",
        user_id,
    )
    if has_notes:
        unlocked_codes.append("TRAVEL_WRITER")

    # 4. Budget master (completed trip within planned budget)
    within_budget = await db.fetchrow(
        """
        SELECT 1 FROM trips t
        WHERE t.creator_id = $1 AND t.status = 'COMPLETED' AND t.budget > 0
          AND (SELECT coalesce(sum(amount)::int, 0) FROM expenses WHERE trip_id = t.id) <= t.budget
        LIMIT 1
        """,
        user_id,
    )
    if within_budget:
        unlocked_codes.append("BUDGET_MASTER")

    # Insert newly unlocked achievements
    for code in unlocked_codes:
        await db.execute(
            """
            INSERT INTO user_achievements (user_id, achievement_id)
            SELECT $1, id FROM travel_achievements WHERE code = $2
            ON CONFLICT DO NOTHING
            """,
            user_id,
            code,
        )

    return unlocked_codes


# -------------------------------------------------------------
# 1. 64-DISTRICT FOOTPRINT
# -------------------------------------------------------------
@router.get("/api/me/footprint")
async def get_my_footprint(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve 64-district exploration metrics, visited district array, and trip timeline."""
    u_uuid = uuid.UUID(str(current_user["id"]))

    passport_rows = await db.fetch(
        """
        SELECT DISTINCT d.district
        FROM passport_entries p
        JOIN destinations d ON d.id = p.destination_id
        WHERE p.user_id = $1
        """,
        u_uuid,
    )
    visited_districts = [r["district"] for r in passport_rows if r.get("district")]

    trips_rows = await db.fetch(
        """
        SELECT t.id, t.name, t.start_date, t.end_date, t.status, d.name AS place, d.image
        FROM trips t
        JOIN destinations d ON d.id = t.destination_id
        WHERE t.creator_id = $1
        ORDER BY t.start_date DESC
        """,
        u_uuid,
    )

    # Calculate travel days as sum of trip durations
    calculated_travel_days = 0
    for t in trips_rows:
        sd = t.get("start_date")
        ed = t.get("end_date")
        if sd and ed:
            try:
                days = (ed - sd).days + 1
                calculated_travel_days += max(days, 1)
            except Exception:
                calculated_travel_days += 4
        else:
            calculated_travel_days += 4

    districts_visited = len(visited_districts)
    timeline = [
        {
            "title": t["name"],
            "place": t["place"],
            "date": f"{t['start_date']} – {t['end_date']}",
            "type": "Solo / Group",
            "image": t["image"] or "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85",
            "status": t["status"],
        }
        for t in trips_rows
    ]

    stats = {
        "districtsVisited": districts_visited,
        "districtsTotal": 64,
        "countriesVisited": 2,
        "countriesTotal": 195,
        "travelDays": calculated_travel_days or (len(trips_rows) * 4) or 18,
        "visitedDistricts": visited_districts,
        "timeline": timeline,
    }
    return stats


# -------------------------------------------------------------
# 2. OFFICIAL PASSPORT BOOKLET & STAMPS
# -------------------------------------------------------------
@router.get("/api/me/passport")
async def list_my_passport_stamps(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve official digital passport stamps for visited destinations."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    query = """
        SELECT p.*, d.name AS destination_name, d.district, d.division, d.image
        FROM passport_entries p
        JOIN destinations d ON d.id = p.destination_id
        WHERE p.user_id = $1
        ORDER BY p.visited_on DESC NULLS LAST
    """
    rows = await db.fetch(query, u_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/api/me/passport", status_code=status.HTTP_201_CREATED)
async def add_passport_stamp(
    data: PassportEntryCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Stamp a destination in passport, update district progress, and trigger badge awards."""
    try:
        dest_uuid = uuid.UUID(data.destinationId)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid destination ID"})

    # Check that destination exists
    destination = await db.fetchrow("SELECT id FROM destinations WHERE id = $1", dest_uuid)
    if not destination:
        return JSONResponse(status_code=404, content={"error": "Destination not found"})

    v_date = parse_date(data.visitedOn) or date.today()

    query = """
        INSERT INTO passport_entries (user_id, destination_id, visited_on, visibility)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, destination_id)
        DO UPDATE SET visited_on = EXCLUDED.visited_on, visibility = EXCLUDED.visibility
        RETURNING *
    """
    row = await db.fetchrow(query, u_uuid, dest_uuid, v_date, data.visibility)
    passport_entry = record_to_dict(row)

    # Evaluate and award milestone badges based on visited districts and destinations
    await evaluate_user_achievements(u_uuid, db)

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=passport_entry)


@router.delete("/api/me/passport/{id}")
async def delete_passport_stamp(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a stamp from user's passport."""
    try:
        p_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid passport entry ID"})

    await db.execute(
        "DELETE FROM passport_entries WHERE id = $1 AND user_id = $2",
        p_uuid,
        u_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# 3. MILESTONE ACHIEVEMENTS & BADGES
# -------------------------------------------------------------
@router.get("/api/me/achievements")
async def list_my_achievements(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List travel milestone achievements and unlocked badges."""
    u_uuid = uuid.UUID(str(current_user["id"]))

    # Evaluate any pending achievements first
    await evaluate_user_achievements(u_uuid, db)

    query = """
        SELECT a.*,
          CASE WHEN ua.achievement_id IS NOT NULL THEN true ELSE false END AS unlocked,
          ua.unlocked_at
        FROM travel_achievements a
        LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
        ORDER BY a.title
    """
    rows = await db.fetch(query, u_uuid)
    return [record_to_dict(r) for r in rows]


# -------------------------------------------------------------
# 4. WISHLIST
# -------------------------------------------------------------
@router.get("/api/me/wishlist")
async def list_my_wishlist(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve saved wishlist destinations."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    query = """
        SELECT d.* FROM destinations d
        JOIN wishlist_destinations w ON w.destination_id = d.id
        WHERE w.user_id = $1
    """
    rows = await db.fetch(query, u_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/api/me/wishlist/{id}")
async def toggle_wishlist_destination(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Toggle a destination in the user's wishlist."""
    try:
        dest_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid destination ID"})

    destination = await db.fetchrow("SELECT id FROM destinations WHERE id = $1", dest_uuid)
    if not destination:
        return JSONResponse(status_code=404, content={"error": "Destination not found"})

    existing = await db.fetchrow(
        "SELECT 1 FROM wishlist_destinations WHERE user_id = $1 AND destination_id = $2",
        u_uuid,
        dest_uuid,
    )
    if existing:
        await db.execute(
            "DELETE FROM wishlist_destinations WHERE user_id = $1 AND destination_id = $2",
            u_uuid,
            dest_uuid,
        )
        return {"wishlisted": False}
    else:
        await db.execute(
            "INSERT INTO wishlist_destinations (user_id, destination_id) VALUES ($1, $2)",
            u_uuid,
            dest_uuid,
        )
        return {"wishlisted": True}
