from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.destinations import ReviewCreateRequest
from app.schemas.reviews import PeerReviewCreateRequest
from app.serializers import record_to_dict

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])
peer_router = APIRouter(tags=["Peer Reviews"])


async def check_is_trip_member(user_id: uuid.UUID, trip_id: uuid.UUID, db: Database) -> bool:
    """Verify if a user is an approved member or creator of a trip."""
    row = await db.fetchrow(
        """
        SELECT 1 FROM trips WHERE id = $1 AND creator_id = $2
        UNION
        SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2
        UNION
        SELECT 1 FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE g.trip_id = $1 AND gm.user_id = $2
        LIMIT 1
        """,
        trip_id,
        user_id,
    )
    return row is not None


# -------------------------------------------------------------
# 1. DESTINATION REVIEWS
# -------------------------------------------------------------
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


# -------------------------------------------------------------
# 2. TRAVELER-TO-TRAVELER PEER REVIEWS
# -------------------------------------------------------------
@peer_router.get("/api/users/{id}/reviewable-trips")
async def list_reviewable_trips(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List completed trips the current traveler shared with this profile and has not reviewed yet."""
    try:
        reviewee_uuid = uuid.UUID(id)
        reviewer_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "User not found"})
    if reviewee_uuid == reviewer_uuid:
        return []
    return [record_to_dict(row) for row in await db.fetch(
        """
        SELECT t.id, t.name
        FROM trips t
        WHERE t.status = 'COMPLETED'
          AND (
            (t.creator_id = $1 AND (t.creator_id = $2 OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = $2) OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id AND gm.user_id = $2)))
            OR
            (t.creator_id = $2 AND (t.creator_id = $1 OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = $1) OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id AND gm.user_id = $1)))
            OR
            (EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = $1) AND (t.creator_id = $2 OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = $2) OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id AND gm.user_id = $2)))
            OR
            (EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id AND gm.user_id = $1) AND (t.creator_id = $2 OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = $2) OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = t.id AND gm.user_id = $2)))
          )
          AND NOT EXISTS (SELECT 1 FROM peer_reviews pr WHERE pr.trip_id = t.id AND pr.reviewer_id = $1 AND pr.reviewee_id = $2)
        ORDER BY t.end_date DESC NULLS LAST
        """,
        reviewer_uuid,
        reviewee_uuid,
    )]


@peer_router.post("/api/peer-reviews", status_code=status.HTTP_201_CREATED)
@peer_router.post("/api/reviews/peer", status_code=status.HTTP_201_CREATED)
async def create_peer_review(
    data: PeerReviewCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Submit a peer review for a fellow traveler after a completed trip."""
    try:
        trip_uuid = uuid.UUID(data.tripId)
        reviewee_uuid = uuid.UUID(data.revieweeId)
        reviewer_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid trip ID or user ID"})

    # 1. No self-review
    if reviewer_uuid == reviewee_uuid:
        return JSONResponse(status_code=400, content={"error": "You cannot review yourself"})

    # 2. Rating between 1 and 5
    if data.rating < 1 or data.rating > 5:
        return JSONResponse(status_code=400, content={"error": "Rating must be between 1 and 5"})

    # 3. Trip existence and completion status
    trip = await db.fetchrow("SELECT id, name, status, creator_id FROM trips WHERE id = $1", trip_uuid)
    if not trip:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    if trip["status"] != "COMPLETED":
        return JSONResponse(status_code=400, content={"error": "Reviews can only be submitted after the trip is completed"})

    # 4. Both users must be approved members of the same trip
    reviewer_is_member = await check_is_trip_member(reviewer_uuid, trip_uuid, db)
    if not reviewer_is_member:
        return JSONResponse(status_code=403, content={"error": "You must be an approved member of this trip to review companions"})

    reviewee_is_member = await check_is_trip_member(reviewee_uuid, trip_uuid, db)
    if not reviewee_is_member:
        return JSONResponse(status_code=400, content={"error": "The reviewed traveler is not a member of this trip"})

    # 5. Unique constraint: check for existing review
    existing = await db.fetchrow(
        "SELECT id FROM peer_reviews WHERE trip_id = $1 AND reviewer_id = $2 AND reviewee_id = $3",
        trip_uuid,
        reviewer_uuid,
        reviewee_uuid,
    )
    if existing:
        return JSONResponse(status_code=400, content={"error": "You have already reviewed this traveler for this trip"})

    # 6. Insert review
    row = await db.fetchrow(
        """
        INSERT INTO peer_reviews (trip_id, reviewer_id, reviewee_id, rating, comment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        trip_uuid,
        reviewer_uuid,
        reviewee_uuid,
        data.rating,
        data.comment.strip(),
    )

    # 7. Notify reviewee
    try:
        await db.execute(
            """
            INSERT INTO notifications (user_id, type, detail, link)
            VALUES ($1, $2, $3, $4)
            """,
            reviewee_uuid,
            "PEER_REVIEW_RECEIVED",
            f"{current_user.get('name', 'A travel mate')} left you a {data.rating}★ review for {trip['name']}.",
            "/profile",
        )
    except Exception:
        pass

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@peer_router.get("/api/users/{id}/reviews")
@peer_router.get("/api/me/reviews")
@peer_router.get("/api/peer-reviews")
async def list_user_peer_reviews(
    id: Optional[str] = None,
    userId: Optional[str] = Query(default=None),
    revieweeId: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List peer reviews received by a user, respecting profile privacy settings."""
    target_raw = id or userId or revieweeId
    is_me = (target_raw is None or target_raw == "me" or str(target_raw) == str(current_user["id"]))
    if is_me:
        target_uuid = uuid.UUID(str(current_user["id"]))
    else:
        try:
            target_uuid = uuid.UUID(target_raw)
        except (ValueError, TypeError):
            return JSONResponse(status_code=404, content={"error": "User not found"})

    target_user = await db.fetchrow("SELECT id, name FROM users WHERE id = $1", target_uuid)
    if not target_user:
        return JSONResponse(status_code=404, content={"error": "User not found"})

    # Check privacy settings if not viewing own reviews and not ADMIN
    is_admin = current_user.get("role") == "ADMIN"
    if not is_me and not is_admin:
        privacy = await db.fetchrow(
            "SELECT profile_visibility, reviews_visibility FROM user_privacy_settings WHERE user_id = $1",
            target_uuid,
        )
        reviews_vis = privacy["reviews_visibility"] if privacy and "reviews_visibility" in privacy else "PUBLIC"
        if reviews_vis == "PRIVATE":
            return {
                "reviews": [],
                "average_rating": None,
                "count": 0,
                "privacy": "PRIVATE",
            }

    rows = await db.fetch(
        """
        SELECT pr.*, u.name AS reviewer_name, coalesce(p.avatar_url, '') AS reviewer_avatar,
          t.name AS trip_name
        FROM peer_reviews pr
        JOIN users u ON u.id = pr.reviewer_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        JOIN trips t ON t.id = pr.trip_id
        WHERE pr.reviewee_id = $1
        ORDER BY pr.created_at DESC
        """,
        target_uuid,
    )
    records = [record_to_dict(r) for r in rows]
    avg_rating = round(sum(r["rating"] for r in records) / len(records), 1) if records else 0.0
    return {
        "reviews": records,
        "average_rating": avg_rating,
        "count": len(records),
        "privacy": "PUBLIC",
    }


@peer_router.get("/api/trips/{trip_id}/peer-reviews/pending")
async def list_pending_peer_reviews(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List travel mates pending review for the current user on a completed trip."""
    try:
        t_uuid = uuid.UUID(trip_id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    trip = await db.fetchrow("SELECT id, name, status, creator_id FROM trips WHERE id = $1", t_uuid)
    if not trip:
        return JSONResponse(status_code=404, content={"error": "Trip not found"})

    # Reviews are only pending once trip is completed
    if trip["status"] != "COMPLETED":
        return []

    # Requester must be a member of this trip
    if not await check_is_trip_member(user_uuid, t_uuid, db) and current_user.get("role") != "ADMIN":
        return JSONResponse(status_code=403, content={"error": "Trip membership required"})

    # Find companions not yet reviewed by current user
    rows = await db.fetch(
        """
        WITH trip_companions AS (
          SELECT creator_id AS user_id FROM trips WHERE id = $1 AND creator_id <> $2
          UNION
          SELECT user_id FROM trip_members WHERE trip_id = $1 AND user_id <> $2
          UNION
          SELECT gm.user_id FROM group_members gm
          JOIN groups g ON g.id = gm.group_id
          WHERE g.trip_id = $1 AND gm.user_id <> $2
        )
        SELECT tc.user_id AS id, u.name, u.email, coalesce(p.avatar_url, '') AS avatar_url
        FROM trip_companions tc
        JOIN users u ON u.id = tc.user_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE tc.user_id NOT IN (
          SELECT reviewee_id FROM peer_reviews WHERE trip_id = $1 AND reviewer_id = $2
        )
        """,
        t_uuid,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]
