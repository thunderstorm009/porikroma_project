import json
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, BackgroundTasks, Body, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.groups import (
    ApplicationStatusUpdateRequest,
    GroupCreateRequest,
    GroupMessageCreateRequest,
)
from app.serializers import record_to_dict
from app.services.email import (
    send_group_application_approved_email,
    send_group_application_rejected_email,
)

router = APIRouter(tags=["Group Expeditions & Applications"])


async def is_confirmed_group_member(
    user_id: str | uuid.UUID,
    group_id: str | uuid.UUID,
    user_role: str,
    db: Database,
) -> bool:
    """Check if the user is a confirmed member or organizer of the group, or an admin."""
    if user_role == "ADMIN":
        return True
    try:
        u_uuid = uuid.UUID(str(user_id))
        g_uuid = uuid.UUID(str(group_id))
    except (ValueError, TypeError):
        return False

    query = """
        SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2
        UNION SELECT 1 FROM groups WHERE id = $1 AND organizer_id = $2
        LIMIT 1
    """
    row = await db.fetchrow(query, g_uuid, u_uuid)
    return row is not None


# -------------------------------------------------------------
# 1. GROUP EXPEDITION CATALOG & DETAILS
# -------------------------------------------------------------
@router.get("/api/groups")
async def list_published_groups(
    db: Database = Depends(get_db),
):
    """List all discoverable published group expeditions."""
    query = """
        SELECT g.*, t.name AS trip_name, t.start_date, t.end_date,
          d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          u.name AS organizer_name, coalesce(up.avatar_url, '') AS organizer_avatar,
          count(gm.user_id)::int AS member_count
        FROM groups g
        JOIN trips t ON t.id = g.trip_id
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = g.organizer_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        WHERE g.published
        GROUP BY g.id, t.name, t.start_date, t.end_date, d.name, d.image, d.district, d.division, u.name, up.avatar_url
        ORDER BY t.start_date ASC
    """
    rows = await db.fetch(query)
    return [record_to_dict(r) for r in rows]


@router.get("/api/groups/my-groups")
async def list_my_groups(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List expeditions organized by or joined by the authenticated user."""
    curr_uuid = uuid.UUID(str(current_user["id"]))
    query = """
        SELECT g.*, t.name AS trip_name, t.start_date, t.end_date, d.name AS destination_name, d.image AS destination_image,
          u.name AS organizer_name,
          count(gm.user_id)::int AS member_count,
          CASE WHEN g.organizer_id = $1 THEN true ELSE false END AS is_organizer
        FROM groups g
        JOIN trips t ON t.id = g.trip_id
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = g.organizer_id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        WHERE g.organizer_id = $1 OR EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = $1)
        GROUP BY g.id, t.name, t.start_date, t.end_date, d.name, d.image, u.name
        ORDER BY t.start_date ASC
    """
    rows = await db.fetch(query, curr_uuid)
    return [record_to_dict(r) for r in rows]


@router.get("/api/groups/{id}")
async def get_group_detail(
    id: str,
    db: Database = Depends(get_db),
):
    """Retrieve full group expedition dossier with itinerary and confirmed members."""
    try:
        g_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    query = """
        SELECT g.*, t.name AS trip_name, t.start_date, t.end_date, t.description AS trip_description,
          d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          u.name AS organizer_name, coalesce(up.avatar_url, '') AS organizer_avatar,
          count(gm.user_id)::int AS member_count
        FROM groups g
        JOIN trips t ON t.id = g.trip_id
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = g.organizer_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        WHERE g.id = $1
        GROUP BY g.id, t.name, t.start_date, t.end_date, t.description, d.name, d.image, d.district, d.division, u.name, up.avatar_url
    """
    group_row = await db.fetchrow(query, g_uuid)
    if not group_row:
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    group = record_to_dict(group_row)

    members_query = """
        SELECT u.id, u.name, u.email, coalesce(up.avatar_url, '') AS avatar_url
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE gm.group_id = $1
    """
    members = await db.fetch(members_query, g_uuid)

    itinerary_query = """
        SELECT * FROM trip_itinerary_items WHERE trip_id = $1 ORDER BY day_date, sort_order
    """
    itinerary = await db.fetch(itinerary_query, uuid.UUID(group["trip_id"]))

    group["members"] = [record_to_dict(m) for m in members]
    group["itinerary"] = [record_to_dict(i) for i in itinerary]
    return group


@router.post("/api/groups", status_code=status.HTTP_201_CREATED)
async def create_group_expedition(
    data: GroupCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Publish a trip as a public group expedition with a seat cap."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    try:
        t_uuid = uuid.UUID(data.tripId)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid trip ID"})

    # Check trip ownership or access
    trip = await db.fetchrow("SELECT creator_id FROM trips WHERE id = $1", t_uuid)
    if not trip:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if str(trip["creator_id"]) != str(u_uuid) and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Trip ownership required to publish an expedition"},
        )

    query = """
        INSERT INTO groups (trip_id, organizer_id, title, capacity, budget_per_person, published)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        t_uuid,
        u_uuid,
        data.title,
        data.capacity,
        data.budgetPerPerson,
        data.published,
    )
    group = record_to_dict(row)
    g_uuid = uuid.UUID(group["id"])

    # Automatically add organizer as member of group_members
    await db.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        g_uuid,
        u_uuid,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=group)


# -------------------------------------------------------------
# 2. GROUP APPLICATIONS & SEAT CAP ENFORCEMENT
# -------------------------------------------------------------
@router.get("/api/groups/{id}/applications")
async def list_group_applications(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List applications for an expedition (organizer only)."""
    try:
        g_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    group = await db.fetchrow("SELECT organizer_id FROM groups WHERE id = $1", g_uuid)
    if not group:
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    if str(group["organizer_id"]) != str(current_user["id"]) and current_user.get("role") != "ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Only the group organizer can view applications"},
        )

    query = """
        SELECT a.*, u.name AS applicant_name, u.email AS applicant_email, coalesce(up.avatar_url, '') AS applicant_avatar
        FROM applications a
        JOIN users u ON u.id = a.applicant_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE a.group_id = $1
        ORDER BY a.created_at DESC
    """
    rows = await db.fetch(query, g_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/api/groups/{id}/applications", status_code=status.HTTP_201_CREATED)
async def submit_group_application(
    id: str,
    answers: Dict[str, Any] = Body(default_factory=dict),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Apply to join a group expedition with multi-question questionnaire and seat cap check."""
    try:
        g_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    group = await db.fetchrow("SELECT id, organizer_id, title, capacity FROM groups WHERE id = $1", g_uuid)
    if not group:
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    # Check if applicant is already a member
    is_member = await db.fetchrow(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        g_uuid,
        u_uuid,
    )
    if is_member:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "You are already a member of this expedition"},
        )

    # Check seat cap
    count_row = await db.fetchrow(
        "SELECT count(*)::int AS member_count FROM group_members WHERE group_id = $1",
        g_uuid,
    )
    member_count = count_row["member_count"] if count_row else 0
    if member_count >= group["capacity"]:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "This group expedition has already reached its seat capacity"},
        )

    query = """
        INSERT INTO applications (group_id, applicant_id, answers, status)
        VALUES ($1, $2, $3::jsonb, 'PENDING')
        ON CONFLICT (group_id, applicant_id)
        DO UPDATE SET answers = EXCLUDED.answers, status = 'PENDING'
        RETURNING *
    """
    row = await db.fetchrow(query, g_uuid, u_uuid, json.dumps(answers))
    app_record = record_to_dict(row)

    # Send notification to organizer
    await db.execute(
        "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
        group["organizer_id"],
        "GROUP_APPLICATION",
        f"New join request for {group['title']}",
        "/group-travel/requests",
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=app_record)


@router.get("/api/me/group-applications")
async def list_my_applications(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """View status of all group applications submitted by the current user."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    query = """
        SELECT a.*, g.title AS group_title, g.budget_per_person, d.name AS destination_name, u.name AS organizer_name
        FROM applications a
        JOIN groups g ON g.id = a.group_id
        JOIN trips t ON t.id = g.trip_id
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = g.organizer_id
        WHERE a.applicant_id = $1
        ORDER BY a.created_at DESC
    """
    rows = await db.fetch(query, u_uuid)
    return [record_to_dict(r) for r in rows]


@router.patch("/api/applications/{id}/status")
async def update_application_status(
    id: str,
    data: ApplicationStatusUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Approve or reject application by organizer, or withdraw by applicant."""
    try:
        a_uuid = uuid.UUID(id)
        curr_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Application not found"})

    query = """
        SELECT a.*, g.organizer_id, g.capacity, g.trip_id, g.title AS group_title,
               u.email AS applicant_email, u.name AS applicant_name
        FROM applications a
        JOIN groups g ON g.id = a.group_id
        LEFT JOIN users u ON u.id = a.applicant_id
        WHERE a.id = $1
    """
    app_record = await db.fetchrow(query, a_uuid)
    if not app_record:
        return JSONResponse(status_code=404, content={"error": "Application not found"})

    # Check permissions
    if data.status in ("APPROVED", "REJECTED"):
        if str(app_record["organizer_id"]) != str(curr_uuid) and current_user.get("role") != "ADMIN":
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Only the group organizer can review applications"},
            )
    elif data.status == "WITHDRAWN":
        if str(app_record["applicant_id"]) != str(curr_uuid):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "You can only withdraw your own application"},
            )

    # Enforce seat cap upon approval
    if data.status == "APPROVED":
        count_row = await db.fetchrow(
            "SELECT count(*)::int AS member_count FROM group_members WHERE group_id = $1",
            app_record["group_id"],
        )
        member_count = count_row["member_count"] if count_row else 0
        if member_count >= app_record["capacity"]:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Cannot approve application: expedition has reached maximum capacity"},
            )

    # Perform status update
    updated_row = await db.fetchrow(
        "UPDATE applications SET status = $1 WHERE id = $2 RETURNING *",
        data.status,
        a_uuid,
    )
    result = record_to_dict(updated_row)

    if data.status == "APPROVED":
        # Add to group_members and trip_members
        await db.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            app_record["group_id"],
            app_record["applicant_id"],
        )
        if app_record.get("trip_id"):
            await db.execute(
                "INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'MEMBER') ON CONFLICT DO NOTHING",
                app_record["trip_id"],
                app_record["applicant_id"],
            )
        # Notify applicant
        await db.execute(
            "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
            app_record["applicant_id"],
            "APPLICATION_APPROVED",
            "Your application to join the group trip was approved!",
            "/group-travel/my-groups",
        )
        # Email applicant in background task
        if app_record.get("applicant_email"):
            background_tasks.add_task(
                send_group_application_approved_email,
                app_record["applicant_email"],
                app_record.get("applicant_name") or "Traveler",
                app_record.get("group_title") or "Expedition Group",
                str(app_record.get("trip_id") or ""),
            )
    elif data.status == "REJECTED":
        # Notify applicant
        await db.execute(
            "INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)",
            app_record["applicant_id"],
            "APPLICATION_REJECTED",
            f"Your application to join {app_record['group_title']} was not approved.",
            "/group-travel/requests",
        )
        # Email applicant in background task
        if app_record.get("applicant_email"):
            background_tasks.add_task(
                send_group_application_rejected_email,
                app_record["applicant_email"],
                app_record.get("applicant_name") or "Traveler",
                app_record.get("group_title") or "Expedition Group",
            )

    return result


# -------------------------------------------------------------
# 3. GROUP CHAT & MESSAGES (CONFIRMED MEMBERS ONLY)
# -------------------------------------------------------------
@router.get("/api/groups/{id}/messages")
async def list_group_messages(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve message history for confirmed members only."""
    try:
        g_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    if not await is_confirmed_group_member(current_user["id"], g_uuid, current_user.get("role", "TRAVELER"), db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Only confirmed group members can access group chat"},
        )

    query = """
        SELECT m.*, u.name AS sender_name, coalesce(p.avatar_url, '') AS sender_avatar
        FROM group_messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE m.group_id = $1
        ORDER BY m.created_at ASC
    """
    rows = await db.fetch(query, g_uuid)
    return [record_to_dict(r) for r in rows]


@router.post("/api/groups/{id}/messages", status_code=status.HTTP_201_CREATED)
async def post_group_message(
    id: str,
    data: GroupMessageCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Post message to group expedition stream (confirmed members only)."""
    try:
        g_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Group expedition not found"})

    if not await is_confirmed_group_member(current_user["id"], g_uuid, current_user.get("role", "TRAVELER"), db):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Only confirmed group members can access group chat"},
        )

    query = """
        INSERT INTO group_messages (group_id, sender_id, body)
        VALUES ($1, $2, $3)
        RETURNING *
    """
    row = await db.fetchrow(query, g_uuid, u_uuid, data.body)
    msg = record_to_dict(row)
    msg["sender_name"] = current_user.get("name")
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=msg)
