from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import require_admin
from app.schemas.destinations import (
    DestinationCreateRequest,
    DestinationUpdateRequest,
)
from app.serializers import record_to_dict

router = APIRouter(prefix="/api/destinations", tags=["Destinations"])


def format_destination(row: dict) -> dict:
    """Format destination record to ensure both snake_case and camelCase budget fields."""
    d = record_to_dict(row)
    if "estimated_budget" in d:
        d["estimatedBudget"] = d["estimated_budget"]
    return d


@router.get("")
async def list_destinations(
    q: Optional[str] = Query(default=None, description="Search term for name, district, division"),
    category: Optional[str] = Query(default=None, description="Category filter"),
    db: Database = Depends(get_db),
):
    """List and search destinations with text search and category filtering."""
    search_param = f"%{q}%" if q else None
    category_param = category if category else None

    query = """
        SELECT d.*,
          coalesce(round(avg(r.rating), 1), 4.8) AS rating,
          count(r.id)::int AS review_count
        FROM destinations d
        LEFT JOIN reviews r ON r.destination_id = d.id
        WHERE ($1::text IS NULL OR d.name ILIKE $1 OR d.district ILIKE $1 OR d.division ILIKE $1)
          AND ($2::text IS NULL OR d.category ILIKE $2)
        GROUP BY d.id
        ORDER BY d.name
    """
    rows = await db.fetch(query, search_param, category_param)
    return [format_destination(r) for r in rows]


@router.get("/{id}")
async def get_destination_detail(
    id: str,
    db: Database = Depends(get_db),
):
    """Get single destination details along with traveler community reviews."""
    try:
        dest_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Destination not found"},
        )

    dest_query = """
        SELECT d.*,
          coalesce(round(avg(r.rating), 1), 4.8) AS rating,
          count(r.id)::int AS review_count
        FROM destinations d
        LEFT JOIN reviews r ON r.destination_id = d.id
        WHERE d.id = $1
        GROUP BY d.id
    """
    dest_row = await db.fetchrow(dest_query, dest_uuid)
    if not dest_row:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Destination not found"},
        )

    reviews_query = """
        SELECT r.*, u.name AS author_name, coalesce(p.avatar_url, '') AS author_avatar
        FROM reviews r
        JOIN users u ON u.id = r.author_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE r.destination_id = $1
        ORDER BY r.created_at DESC
    """
    review_rows = await db.fetch(reviews_query, dest_uuid)

    formatted_dest = format_destination(dest_row)
    formatted_dest["reviews"] = [record_to_dict(r) for r in review_rows]
    return formatted_dest


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_destination(
    data: DestinationCreateRequest,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Admin-only endpoint to create a new destination."""
    query = """
        INSERT INTO destinations (name, division, district, description, category, estimated_budget, image)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        data.name,
        data.division,
        data.district,
        data.description,
        data.category,
        data.estimatedBudget,
        data.image,
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=format_destination(row),
    )


@router.put("/{id}")
async def update_destination(
    id: str,
    data: DestinationUpdateRequest,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Admin-only endpoint to update an existing destination."""
    try:
        dest_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Destination not found"},
        )

    query = """
        UPDATE destinations
        SET name = $1, division = $2, district = $3, description = $4, category = $5, estimated_budget = $6, image = $7
        WHERE id = $8
        RETURNING *
    """
    row = await db.fetchrow(
        query,
        data.name,
        data.division,
        data.district,
        data.description,
        data.category,
        data.estimatedBudget,
        data.image,
        dest_uuid,
    )
    if not row:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Destination not found"},
        )
    return format_destination(row)


@router.delete("/{id}")
async def delete_destination(
    id: str,
    current_admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Admin-only endpoint to delete a destination from catalog."""
    try:
        dest_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Destination not found"},
        )

    await db.execute("DELETE FROM destinations WHERE id = $1", dest_uuid)
    return {"success": True}


@router.get("/{id}/reviews")
async def list_destination_reviews(
    id: str,
    db: Database = Depends(get_db),
):
    """List reviews specifically for a given destination."""
    try:
        dest_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return []

    query = """
        SELECT r.*, u.name AS author_name
        FROM reviews r
        JOIN users u ON u.id = r.author_id
        WHERE r.destination_id = $1
        ORDER BY r.created_at DESC
    """
    rows = await db.fetch(query, dest_uuid)
    return [record_to_dict(r) for r in rows]
