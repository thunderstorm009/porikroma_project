from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.destinations import ReviewCreateRequest
from app.serializers import record_to_dict

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Submit or update a 1-5 star review for a destination."""
    try:
        dest_uuid = uuid.UUID(data.destinationId)
        author_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Invalid destination ID or author ID"},
        )

    query = """
        INSERT INTO reviews (destination_id, author_id, rating, body)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (destination_id, author_id)
        DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body
        RETURNING *
    """
    row = await db.fetchrow(query, dest_uuid, author_uuid, data.rating, data.body)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=record_to_dict(row),
    )


@router.get("")
async def list_reviews(
    destination_id: Optional[str] = Query(default=None, alias="destinationId"),
    db: Database = Depends(get_db),
):
    """List reviews, optionally filtered by destination."""
    dest_uuid = None
    if destination_id:
        try:
            dest_uuid = uuid.UUID(destination_id)
        except (ValueError, TypeError):
            return []

    query = """
        SELECT r.*, u.name AS author_name, coalesce(p.avatar_url, '') AS author_avatar
        FROM reviews r
        JOIN users u ON u.id = r.author_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE ($1::uuid IS NULL OR r.destination_id = $1)
        ORDER BY r.created_at DESC
    """
    rows = await db.fetch(query, dest_uuid)
    return [record_to_dict(r) for r in rows]
