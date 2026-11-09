import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.serializers import record_to_dict

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List in-app notifications for the authenticated user."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
        u_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.patch("/read-all")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Mark all notifications as read for current user."""
    u_uuid = uuid.UUID(str(current_user["id"]))
    await db.execute(
        "UPDATE notifications SET read = true WHERE user_id = $1",
        u_uuid,
    )
    return {"success": True}


@router.patch("/{id}/read")
async def mark_notification_read(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Mark a single notification as read."""
    try:
        n_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Notification not found"})

    row = await db.fetchrow(
        "UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *",
        n_uuid,
        u_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Notification not found"})
    return record_to_dict(row)


@router.delete("/{id}")
async def delete_notification(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a notification."""
    try:
        n_uuid = uuid.UUID(id)
        u_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Notification not found"})

    await db.execute(
        "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
        n_uuid,
        u_uuid,
    )
    return {"success": True}
