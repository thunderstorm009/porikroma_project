from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user, require_admin
from app.schemas.admin import (
    ReportActionRequest,
    UserReportCreateRequest,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
    VerificationCreateRequest,
    VerificationStatusUpdateRequest,
)
from app.serializers import record_to_dict

router = APIRouter(tags=["Admin Control Center & Moderation"])


# -------------------------------------------------------------
# 1. PLATFORM ANALYTICS
# -------------------------------------------------------------
@router.get("/api/admin/analytics")
async def get_admin_analytics(
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Retrieve platform-wide operational and engagement metrics (ADMIN only)."""
    row = await db.fetchrow(
        """
        SELECT
          (SELECT count(*)::int FROM users) AS users,
          (SELECT count(*)::int FROM users WHERE role = 'TOUR_PLANNER') AS planners,
          (SELECT count(*)::int FROM trips) AS trips,
          (SELECT count(*)::int FROM groups WHERE published) AS active_groups,
          (SELECT count(*)::int FROM tours WHERE status = 'PUBLISHED') AS published_tours,
          (SELECT count(*)::int FROM user_reports) AS reports,
          (SELECT count(*)::int FROM verification_requests WHERE status = 'PENDING') AS pending_verifications
        """
    )
    return record_to_dict(row)


# -------------------------------------------------------------
# 2. USER DIRECTORY & ROLE / STATUS MANAGEMENT
# -------------------------------------------------------------
@router.get("/api/admin/users")
async def list_admin_users(
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """List all registered users across the platform with trip counts (ADMIN only)."""
    rows = await db.fetch(
        """
        SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
          (SELECT count(*)::int FROM trips WHERE creator_id = u.id) AS trips_count
        FROM users u
        ORDER BY u.created_at DESC
        """
    )
    return [record_to_dict(r) for r in rows]


@router.patch("/api/admin/users/{id}/role")
async def update_user_role(
    id: str,
    data: UserRoleUpdateRequest,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Change a user's role between TRAVELER, TOUR_PLANNER, and ADMIN (ADMIN only)."""
    try:
        user_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "User not found"})

    row = await db.fetchrow(
        """
        UPDATE users
        SET role = $1
        WHERE id = $2
        RETURNING id, name, email, role
        """,
        data.role,
        user_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "User not found"})
    return record_to_dict(row)


@router.patch("/api/admin/users/{id}/status")
async def update_user_status(
    id: str,
    data: UserStatusUpdateRequest,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Ban, suspend, or reactivate a user account (ADMIN only)."""
    try:
        user_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "User not found"})

    row = await db.fetchrow(
        """
        UPDATE users
        SET status = $1
        WHERE id = $2
        RETURNING id, name, email, status
        """,
        data.status,
        user_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "User not found"})
    return record_to_dict(row)


# -------------------------------------------------------------
# 3. TOUR PLANNER VERIFICATION QUEUE
# -------------------------------------------------------------
@router.get("/api/admin/verifications")
async def list_admin_verifications(
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """List pending and reviewed tour planner verification requests (ADMIN only)."""
    rows = await db.fetch(
        """
        SELECT v.*, u.name AS user_name, u.email AS user_email
        FROM verification_requests v
        JOIN users u ON u.id = v.user_id
        ORDER BY v.created_at DESC
        """
    )
    return [record_to_dict(r) for r in rows]


@router.patch("/api/admin/verifications/{id}")
async def review_admin_verification(
    id: str,
    data: VerificationStatusUpdateRequest,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Approve or reject a planner verification request. Upgrades role on approval (ADMIN only)."""
    try:
        verif_uuid = uuid.UUID(id)
        admin_uuid = uuid.UUID(str(current_admin["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Verification request not found"})

    row = await db.fetchrow(
        """
        UPDATE verification_requests
        SET status = $1, reviewed_by = $2, reviewed_at = now()
        WHERE id = $3
        RETURNING *
        """,
        data.status,
        admin_uuid,
        verif_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Verification request not found"})

    if data.status == "APPROVED":
        target_user_id = row["user_id"]
        # Upgrade role to TOUR_PLANNER
        await db.execute(
            "UPDATE users SET role = 'TOUR_PLANNER' WHERE id = $1",
            target_user_id,
        )
        # Notify user
        try:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                target_user_id,
                "VERIFICATION_APPROVED",
                "Your tour planner application was approved! Welcome.",
                "/planner/dashboard",
            )
        except Exception:
            pass

    return record_to_dict(row)


# -------------------------------------------------------------
# 4. PLATFORM TRIPS & GROUPS MONITORING
# -------------------------------------------------------------
@router.get("/api/admin/trips")
async def list_admin_trips(
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Monitor all traveler trips created across the platform (ADMIN only)."""
    rows = await db.fetch(
        """
        SELECT t.*, u.name AS creator_name, d.name AS destination_name
        FROM trips t
        JOIN users u ON u.id = t.creator_id
        JOIN destinations d ON d.id = t.destination_id
        ORDER BY t.created_at DESC
        """
    )
    return [record_to_dict(r) for r in rows]


@router.get("/api/admin/groups")
async def list_admin_groups(
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Monitor all published group expeditions across the platform (ADMIN only)."""
    rows = await db.fetch(
        """
        SELECT g.*, u.name AS organizer_name, t.name AS trip_name
        FROM groups g
        JOIN users u ON u.id = g.organizer_id
        JOIN trips t ON t.id = g.trip_id
        ORDER BY g.title ASC
        """
    )
    return [record_to_dict(r) for r in rows]


# -------------------------------------------------------------
# 5. MODERATION REPORTS & ACTIONS
# -------------------------------------------------------------
@router.get("/api/admin/reports")
async def list_admin_reports(
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """List all community and user moderation reports (ADMIN only)."""
    rows = await db.fetch(
        """
        SELECT r.*, reporter.name AS reporter_name, reported.name AS reported_user_name
        FROM user_reports r
        JOIN users reporter ON reporter.id = r.reporter_id
        JOIN users reported ON reported.id = r.reported_user_id
        ORDER BY r.created_at DESC
        """
    )
    return [record_to_dict(r) for r in rows]


@router.post("/api/admin/reports/{id}/actions", status_code=status.HTTP_201_CREATED)
async def take_moderation_action(
    id: str,
    data: ReportActionRequest,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Enforce moderation actions on reported users: DISMISSED, WARNING, SUSPENDED, BANNED (ADMIN only)."""
    try:
        report_uuid = uuid.UUID(id)
        admin_uuid = uuid.UUID(str(current_admin["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Report not found"})

    report = await db.fetchrow("SELECT id, reported_user_id FROM user_reports WHERE id = $1", report_uuid)
    if not report:
        return JSONResponse(status_code=404, content={"error": "Report not found"})

    action_row = await db.fetchrow(
        """
        INSERT INTO moderation_actions (report_id, admin_id, action, note)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        report_uuid,
        admin_uuid,
        data.action,
        data.note,
    )

    if data.action in ("SUSPENDED", "BANNED"):
        await db.execute(
            "UPDATE users SET status = $1 WHERE id = $2",
            data.action,
            report["reported_user_id"],
        )

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(action_row))


# -------------------------------------------------------------
# 6. USER SUBMISSIONS: VERIFICATION & REPORTING
# -------------------------------------------------------------
@router.post("/api/me/verification", status_code=status.HTTP_201_CREATED)
async def submit_planner_verification_request(
    data: VerificationCreateRequest = VerificationCreateRequest(),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Submit an application to be verified as a professional tour planner."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        """
        INSERT INTO verification_requests (user_id, note)
        VALUES ($1, $2)
        RETURNING *
        """,
        user_uuid,
        data.note,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@router.post("/api/users/{id}/reports", status_code=status.HTTP_201_CREATED)
async def submit_user_report(
    id: str,
    data: UserReportCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """File a moderation report against a user for inappropriate behavior or spam."""
    try:
        reported_uuid = uuid.UUID(id)
        reporter_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "User not found"})

    if reported_uuid == reporter_uuid:
        return JSONResponse(status_code=400, content={"error": "You cannot report yourself"})

    target = await db.fetchrow("SELECT id FROM users WHERE id = $1", reported_uuid)
    if not target:
        return JSONResponse(status_code=404, content={"error": "User not found"})

    row = await db.fetchrow(
        """
        INSERT INTO user_reports (reporter_id, reported_user_id, reason)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
        """,
        reporter_uuid,
        reported_uuid,
        data.reason.strip(),
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))
