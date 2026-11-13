import asyncio
from datetime import date, datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.trips import (
    ChecklistItemCreateRequest,
    ChecklistItemUpdateRequest,
    ItineraryItemCreateRequest,
    ItineraryItemUpdateRequest,
    TripCreateRequest,
    TripMapPlaceCreateRequest,
    TripMemberAddRequest,
    TripNoteCreateRequest,
    TripPhotoCreateRequest,
    TripStatusUpdateRequest,
    TripUpdateRequest,
)
from app.serializers import record_to_dict

router = APIRouter(prefix="/api/trips", tags=["Trips & Workspace"])


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


async def check_trip_access(
    user_id: str | uuid.UUID,
    trip_id: str | uuid.UUID,
    db: Database,
) -> bool:
    """Helper verifying if user is creator, member, or expedition participant."""
    try:
        u_uuid = uuid.UUID(str(user_id))
        t_uuid = uuid.UUID(str(trip_id))
    except (ValueError, TypeError):
        return False

    query = """
        SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2
        UNION SELECT 1 FROM trips WHERE id = $1 AND creator_id = $2
        UNION SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = $1 AND gm.user_id = $2
        LIMIT 1
    """
    row = await db.fetchrow(query, t_uuid, u_uuid)
    return row is not None


async def stamp_completed_trip(trip_id: uuid.UUID, db: Database) -> None:
    """Add the completed destination to every trip participant's passport once."""
    await db.execute(
        """
        INSERT INTO passport_entries (user_id, destination_id, visited_on, visibility)
        SELECT participants.user_id, t.destination_id, t.end_date, 'PRIVATE'
        FROM trips t
        CROSS JOIN LATERAL (
          SELECT t.creator_id AS user_id
          UNION
          SELECT tm.user_id FROM trip_members tm WHERE tm.trip_id = t.id
          UNION
          SELECT gm.user_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id
        ) participants
        WHERE t.id = $1
        ON CONFLICT (user_id, destination_id)
        DO UPDATE SET visited_on = coalesce(passport_entries.visited_on, EXCLUDED.visited_on)
        """,
        trip_id,
    )


async def check_trip_read_access(
    user_id: str | uuid.UUID,
    trip_id: uuid.UUID,
    user_role: str,
    db: Database,
) -> tuple[bool, Optional[str], Optional[dict]]:
    """Check if user can read the trip. Returns (allowed, error_message, trip_dict)."""
    query = """
        SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          coalesce((SELECT sum(amount)::int FROM expenses WHERE trip_id = t.id), 0) AS total_spent
        FROM trips t
        JOIN destinations d ON d.id = t.destination_id
        WHERE t.id = $1
    """
    row = await db.fetchrow(query, trip_id)
    if not row:
        return False, "Trip not found", None

    trip = record_to_dict(row)
    if trip.get("visibility") == "PRIVATE":
        if user_role != "ADMIN" and not await check_trip_access(user_id, trip_id, db):
            return False, "Trip membership required", None

    return True, None, trip


# -------------------------------------------------------------
# CORE TRIPS CRUD & LISTINGS
# -------------------------------------------------------------
@router.get("")
async def list_trips(
    status: Optional[str] = Query(default=None),
    visibility: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None, alias="userId"),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List accessible trips with destination metadata, total spent, and member counts."""
    curr_uuid = uuid.UUID(str(current_user["id"]))
    target_creator_uuid = None
    if user_id:
        try:
            target_creator_uuid = uuid.UUID(user_id)
        except (ValueError, TypeError):
            pass

    query = """
        SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          coalesce((SELECT sum(amount)::int FROM expenses WHERE trip_id = t.id), 0) AS total_spent,
          (SELECT count(*)::int FROM trip_members WHERE trip_id = t.id) AS member_count
        FROM trips t
        JOIN destinations d ON d.id = t.destination_id
        WHERE (
          ($4::uuid IS NOT NULL AND $4 <> $1 AND (t.visibility = 'PUBLIC' OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1)))
          OR ($3::text = 'PUBLIC' AND t.visibility = 'PUBLIC')
          OR (t.creator_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1)
              OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id AND gm.user_id = $1))
        )
          AND ($2::text IS NULL OR t.status = $2)
          AND ($3::text IS NULL OR t.visibility = $3)
          AND ($4::uuid IS NULL OR t.creator_id = $4)
        ORDER BY t.start_date DESC
    """
    rows = await db.fetch(query, curr_uuid, status, visibility, target_creator_uuid)
    return [record_to_dict(r) for r in rows]


@router.get("/{id}")
async def get_trip(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Get single trip details and check access permissions."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    allowed, err_msg, trip = await check_trip_read_access(
        current_user["id"], t_uuid, current_user.get("role", "TRAVELER"), db
    )
    if not allowed:
        status_code = status.HTTP_404_NOT_FOUND if err_msg == "Trip not found" else status.HTTP_403_FORBIDDEN
        return JSONResponse(status_code=status_code, content={"error": err_msg})

    return trip


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Create a new trip and add creator as OWNER in trip_members."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    try:
        dest_uuid = uuid.UUID(data.destinationId)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid destination ID"})

    start_d = parse_date(data.startDate)
    end_d = parse_date(data.endDate)

    query = """
        INSERT INTO trips (creator_id, destination_id, name, start_date, end_date, visibility, status, budget, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        u_uuid,
        dest_uuid,
        data.name,
        start_d,
        end_d,
        data.visibility,
        data.status,
        data.budget,
        data.description,
    )
    trip = record_to_dict(row)
    t_uuid = uuid.UUID(trip["id"])

    await db.execute(
        "INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING",
        t_uuid,
        u_uuid,
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=trip,
    )


@router.put("/{id}")
async def update_trip(
    id: str,
    data: TripUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update trip details (requires trip ownership or membership)."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    has_access = await check_trip_access(current_user["id"], t_uuid, db)
    if not has_access and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip ownership required"},
        )

    start_d = parse_date(data.startDate) if data.startDate else None
    end_d = parse_date(data.endDate) if data.endDate else None
    dest_uuid = uuid.UUID(data.destinationId) if data.destinationId else None

    query = """
        UPDATE trips
        SET name = coalesce($1, name),
            start_date = coalesce($2, start_date),
            end_date = coalesce($3, end_date),
            budget = coalesce($4, budget),
            visibility = coalesce($5, visibility),
            status = coalesce($6, status),
            description = coalesce($7, description),
            destination_id = coalesce($8, destination_id)
        WHERE id = $9
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        data.name,
        start_d,
        end_d,
        data.budget,
        data.visibility,
        data.status,
        data.description,
        dest_uuid,
        t_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})
    return record_to_dict(row)


@router.delete("/{id}")
async def delete_trip(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete trip (requires trip ownership or membership)."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    has_access = await check_trip_access(current_user["id"], t_uuid, db)
    if not has_access and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip ownership required"},
        )

    await db.execute("DELETE FROM trips WHERE id = $1", t_uuid)
    return {"success": True}


@router.patch("/{id}/status")
async def update_trip_status(
    id: str,
    data: TripStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update trip lifecycle status."""
    try:
        t_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    row = await db.fetchrow(
        "UPDATE trips SET status = $1 WHERE id = $2 AND (creator_id = $3 OR $4 = 'ADMIN') RETURNING *",
        data.status,
        t_uuid,
        u_uuid,
        current_user.get("role", "TRAVELER"),
    )
    if not row:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Trip not found or not owned by you"},
        )
    if data.status == "COMPLETED":
        await stamp_completed_trip(t_uuid, db)
    return record_to_dict(row)


# -------------------------------------------------------------
# FULL TRIP WORKSPACE LOADER (8 TABS)
# -------------------------------------------------------------
@router.get("/{id}/workspace")
async def get_trip_workspace(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Fetch complete workspace payload covering all 8 tabs."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    trip_query = """
        SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          coalesce((SELECT sum(amount)::int FROM expenses WHERE trip_id = t.id), 0) AS total_spent
        FROM trips t
        JOIN destinations d ON d.id = t.destination_id
        WHERE t.id = $1
    """
    trip_row = await db.fetchrow(trip_query, t_uuid)
    if not trip_row:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    trip = record_to_dict(trip_row)
    if trip.get("visibility") == "PRIVATE":
        has_access = await check_trip_access(current_user["id"], t_uuid, db)
        if not has_access and current_user.get("role") != "ADMIN":
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Trip membership required"},
            )

    # Concurrently load all workspace datasets
    itinerary_task = db.fetch(
        "SELECT * FROM trip_itinerary_items WHERE trip_id = $1 ORDER BY day_date, sort_order",
        t_uuid,
    )
    checklist_task = db.fetch(
        "SELECT * FROM trip_checklists WHERE trip_id = $1 ORDER BY created_at",
        t_uuid,
    )
    notes_task = db.fetch(
        """
        SELECT n.*, u.name AS author_name
        FROM trip_notes n
        JOIN users u ON u.id = n.author_id
        WHERE n.trip_id = $1
        ORDER BY n.created_at DESC
        """,
        t_uuid,
    )
    photos_task = db.fetch(
        "SELECT * FROM trip_photos WHERE trip_id = $1 ORDER BY created_at DESC",
        t_uuid,
    )
    members_task = db.fetch(
        """
        SELECT u.id, u.name, u.email, tm.role, tm.joined_at, coalesce(p.avatar_url, '') AS avatar_url
        FROM trip_members tm
        JOIN users u ON u.id = tm.user_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE tm.trip_id = $1
        """,
        t_uuid,
    )
    expenses_task = db.fetch(
        """
        SELECT e.*, u.name AS paid_by_name
        FROM expenses e
        JOIN users u ON u.id = e.paid_by
        WHERE e.trip_id = $1
        ORDER BY e.expense_date DESC
        """,
        t_uuid,
    )
    map_places_task = db.fetch(
        "SELECT * FROM trip_map_places WHERE trip_id = $1 ORDER BY created_at",
        t_uuid,
    )
    group_task = db.fetchrow(
        "SELECT * FROM groups WHERE trip_id = $1 LIMIT 1",
        t_uuid,
    )

    (
        itinerary,
        checklist,
        notes,
        photos,
        members,
        expenses,
        map_places,
        group,
    ) = await asyncio.gather(
        itinerary_task,
        checklist_task,
        notes_task,
        photos_task,
        members_task,
        expenses_task,
        map_places_task,
        group_task,
    )

    return {
        "trip": trip,
        "itinerary": [record_to_dict(r) for r in itinerary],
        "checklist": [record_to_dict(r) for r in checklist],
        "notes": [record_to_dict(r) for r in notes],
        "photos": [record_to_dict(r) for r in photos],
        "members": [record_to_dict(r) for r in members],
        "expenses": [record_to_dict(r) for r in expenses],
        "mapPlaces": [record_to_dict(r) for r in map_places],
        "group": record_to_dict(group) if group else None,
    }


# -------------------------------------------------------------
# ITINERARY ITEMS
# -------------------------------------------------------------
@router.post("/{id}/itinerary", status_code=status.HTTP_201_CREATED)
async def create_itinerary_item(
    id: str,
    data: ItineraryItemCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Add a daily itinerary item to the trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    day_d = parse_date(data.dayDate)
    query = """
        INSERT INTO trip_itinerary_items (trip_id, day_date, title, location, notes, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        t_uuid,
        day_d,
        data.title,
        data.location,
        data.notes,
        data.sortOrder,
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=record_to_dict(row),
    )


@router.put("/{id}/itinerary/{item_id}")
async def update_itinerary_item(
    id: str,
    item_id: str,
    data: ItineraryItemUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update an itinerary item."""
    try:
        t_uuid = uuid.UUID(id)
        i_uuid = uuid.UUID(item_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Item not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    day_d = parse_date(data.dayDate) if data.dayDate else None
    query = """
        UPDATE trip_itinerary_items
        SET title = coalesce($1, title),
            day_date = coalesce($2, day_date),
            location = coalesce($3, location),
            notes = coalesce($4, notes),
            sort_order = coalesce($5, sort_order)
        WHERE id = $6 AND trip_id = $7
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        data.title,
        day_d,
        data.location,
        data.notes,
        data.sortOrder,
        i_uuid,
        t_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Itinerary item not found"})
    return record_to_dict(row)


@router.delete("/{id}/itinerary/{item_id}")
async def delete_itinerary_item(
    id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete an itinerary item."""
    try:
        t_uuid = uuid.UUID(id)
        i_uuid = uuid.UUID(item_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Item not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    await db.execute(
        "DELETE FROM trip_itinerary_items WHERE id = $1 AND trip_id = $2",
        i_uuid,
        t_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# CHECKLIST ITEMS
# -------------------------------------------------------------
@router.post("/{id}/checklist", status_code=status.HTTP_201_CREATED)
async def create_checklist_item(
    id: str,
    data: ChecklistItemCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Add a checklist item to the trip."""
    try:
        t_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    query = """
        INSERT INTO trip_checklists (trip_id, title, created_by)
        VALUES ($1, $2, $3)
        RETURNING *
    """
    row = await db.fetchrow(query, t_uuid, data.title, u_uuid)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=record_to_dict(row),
    )


@router.patch("/{id}/checklist/{item_id}")
async def toggle_checklist_item(
    id: str,
    item_id: str,
    data: ChecklistItemUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Toggle completion status of a checklist item."""
    try:
        t_uuid = uuid.UUID(id)
        c_uuid = uuid.UUID(item_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Item not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    query = """
        UPDATE trip_checklists
        SET completed = $1
        WHERE id = $2 AND trip_id = $3
        RETURNING *
    """
    row = await db.fetchrow(query, data.completed, c_uuid, t_uuid)
    if not row:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Checklist item not found"},
        )
    return record_to_dict(row)


@router.delete("/{id}/checklist/{item_id}")
async def delete_checklist_item(
    id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a checklist item."""
    try:
        t_uuid = uuid.UUID(id)
        c_uuid = uuid.UUID(item_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Item not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    await db.execute(
        "DELETE FROM trip_checklists WHERE id = $1 AND trip_id = $2",
        c_uuid,
        t_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# NOTES & JOURNAL MEMORIES
# -------------------------------------------------------------
@router.get("/{id}/notes")
async def list_trip_notes(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List notes for a trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    allowed, err_msg, _ = await check_trip_read_access(
        current_user["id"], t_uuid, current_user.get("role", "TRAVELER"), db
    )
    if not allowed:
        status_code = status.HTTP_404_NOT_FOUND if err_msg == "Trip not found" else status.HTTP_403_FORBIDDEN
        return JSONResponse(status_code=status_code, content={"error": err_msg})

    query = """
        SELECT n.*, u.name AS author_name
        FROM trip_notes n
        JOIN users u ON u.id = n.author_id
        WHERE n.trip_id = $1
        ORDER BY n.created_at DESC
    """
    rows = await db.fetch(query, t_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/{id}/notes", status_code=status.HTTP_201_CREATED)
async def create_trip_note(
    id: str,
    data: TripNoteCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Add a journal note / memory to the trip."""
    try:
        t_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    query = """
        INSERT INTO trip_notes (trip_id, author_id, body)
        VALUES ($1, $2, $3)
        RETURNING *
    """
    row = await db.fetchrow(query, t_uuid, u_uuid, data.body)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=record_to_dict(row),
    )


@router.delete("/{id}/notes/{note_id}")
async def delete_trip_note(
    id: str,
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a note from the trip."""
    try:
        t_uuid = uuid.UUID(id)
        n_uuid = uuid.UUID(note_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Note not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    await db.execute(
        "DELETE FROM trip_notes WHERE id = $1 AND trip_id = $2",
        n_uuid,
        t_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# TRIP PHOTOS
# -------------------------------------------------------------
@router.get("/{id}/photos")
async def list_trip_photos(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List photos uploaded to a trip (scoped to trip members only)."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    trip = await db.fetchrow("SELECT id, creator_id FROM trips WHERE id = $1", t_uuid)
    if not trip:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db) and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required to view photos"},
        )

    rows = await db.fetch(
        """
        SELECT tp.*, coalesce(tp.user_id, tp.uploaded_by) AS user_id,
          u.name AS user_name, u.email AS user_email
        FROM trip_photos tp
        LEFT JOIN users u ON u.id = coalesce(tp.user_id, tp.uploaded_by)
        WHERE tp.trip_id = $1
        ORDER BY tp.created_at DESC
        """,
        t_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.post("/{id}/photos", status_code=status.HTTP_201_CREATED)
async def upload_trip_photo(
    id: str,
    data: TripPhotoCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Add a photo URL to the trip (scoped to trip members only)."""
    try:
        t_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    trip = await db.fetchrow("SELECT id, creator_id FROM trips WHERE id = $1", t_uuid)
    if not trip:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db) and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required to add photos"},
        )

    taken_at_dt = None
    if getattr(data, "taken_at", None):
        try:
            taken_at_dt = datetime.fromisoformat(str(data.taken_at).replace("Z", "+00:00"))
        except Exception:
            taken_at_dt = None

    query = """
        INSERT INTO trip_photos (trip_id, user_id, url, caption, taken_at)
        VALUES ($1, $2, $3, $4, coalesce($5, now()))
        RETURNING *
    """
    row = await db.fetchrow(query, t_uuid, u_uuid, data.url, data.caption or "", taken_at_dt)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=record_to_dict(row),
    )


@router.delete("/{id}/photos/{photo_id}")
async def delete_trip_photo(
    id: str,
    photo_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a photo from the trip (owner of the photo or trip organizer only)."""
    try:
        t_uuid = uuid.UUID(id)
        p_uuid = uuid.UUID(photo_id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Photo not found"})

    trip = await db.fetchrow("SELECT id, creator_id FROM trips WHERE id = $1", t_uuid)
    if not trip:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db) and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    photo = await db.fetchrow(
        "SELECT id, trip_id, coalesce(user_id, uploaded_by) AS user_id FROM trip_photos WHERE id = $1 AND trip_id = $2",
        p_uuid,
        t_uuid,
    )
    if not photo:
        return JSONResponse(status_code=404, content={"error": "Photo not found"})

    is_photo_owner = str(photo.get("user_id")) == str(u_uuid)
    is_trip_organizer = str(trip.get("creator_id")) == str(u_uuid)
    is_admin = current_user.get("role") == "ADMIN"

    if not (is_photo_owner or is_trip_organizer or is_admin):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Only the photo owner or trip organizer can delete this photo"},
        )

    await db.execute(
        "DELETE FROM trip_photos WHERE id = $1 AND trip_id = $2",
        p_uuid,
        t_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# MAP PLACES (TRIP_MAP_PLACES)
# -------------------------------------------------------------
@router.get("/{id}/map-places")
async def list_trip_map_places(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List saved interactive map places for a trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    allowed, err_msg, _ = await check_trip_read_access(
        current_user["id"], t_uuid, current_user.get("role", "TRAVELER"), db
    )
    if not allowed:
        status_code = status.HTTP_404_NOT_FOUND if err_msg == "Trip not found" else status.HTTP_403_FORBIDDEN
        return JSONResponse(status_code=status_code, content={"error": err_msg})

    rows = await db.fetch(
        "SELECT * FROM trip_map_places WHERE trip_id = $1 ORDER BY created_at",
        t_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.post("/{id}/map-places", status_code=status.HTTP_201_CREATED)
async def create_trip_map_place(
    id: str,
    data: TripMapPlaceCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Save a point of interest or map place to the trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    query = """
        INSERT INTO trip_map_places (trip_id, name, category, notes, lat, lng)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        t_uuid,
        data.name,
        data.category,
        data.notes,
        data.lat,
        data.lng,
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=record_to_dict(row),
    )


@router.delete("/{id}/map-places/{place_id}")
async def delete_trip_map_place(
    id: str,
    place_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a saved map place."""
    try:
        t_uuid = uuid.UUID(id)
        p_uuid = uuid.UUID(place_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Place not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    await db.execute(
        "DELETE FROM trip_map_places WHERE id = $1 AND trip_id = $2",
        p_uuid,
        t_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# TRIP MEMBERS
# -------------------------------------------------------------
@router.get("/{id}/members")
async def list_trip_members(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List members and collaborators associated with the trip."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    allowed, err_msg, _ = await check_trip_read_access(
        current_user["id"], t_uuid, current_user.get("role", "TRAVELER"), db
    )
    if not allowed:
        status_code = status.HTTP_404_NOT_FOUND if err_msg == "Trip not found" else status.HTTP_403_FORBIDDEN
        return JSONResponse(status_code=status_code, content={"error": err_msg})

    query = """
        SELECT u.id, u.name, u.email, tm.role, tm.joined_at, coalesce(p.avatar_url, '') AS avatar_url
        FROM trip_members tm
        JOIN users u ON u.id = tm.user_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE tm.trip_id = $1
    """
    rows = await db.fetch(query, t_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/{id}/members", status_code=status.HTTP_201_CREATED)
async def add_trip_member(
    id: str,
    data: TripMemberAddRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Add a new member to the trip by email and send platform notification."""
    try:
        t_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    target_user = await db.fetchrow(
        "SELECT id, name, email FROM users WHERE email = lower($1)",
        data.email,
    )
    if not target_user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "User with that email was not found"},
        )

    target_dict = record_to_dict(target_user)
    target_uuid = uuid.UUID(target_dict["id"])

    await db.execute(
        "INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'MEMBER') ON CONFLICT DO NOTHING",
        t_uuid,
        target_uuid,
    )
    await db.execute(
        "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
        target_uuid,
        "TRIP_INVITATION",
        "You were added as a member to a trip",
        f"/trips/{id}",
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=target_dict,
    )


@router.delete("/{id}/members/{user_id}")
async def remove_trip_member(
    id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Remove a member from the trip."""
    try:
        t_uuid = uuid.UUID(id)
        target_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "User not found"})

    if not await check_trip_access(current_user["id"], t_uuid, db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip membership required"},
        )

    await db.execute(
        "DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2",
        t_uuid,
        target_uuid,
    )
    return {"success": True}
