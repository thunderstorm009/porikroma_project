import uuid
from fastapi import APIRouter, Depends
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.users import (
    PrivacySettingsUpdateRequest,
    ProfileUpdateRequest,
)
from app.serializers import record_to_dict

router = APIRouter(prefix="/api/me", tags=["Current User & Profile"])


@router.get("")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Get the current authenticated user's core details."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        "SELECT id, name, email, role, created_at, status FROM users WHERE id = $1",
        user_uuid,
    )
    return record_to_dict(row or current_user)


@router.get("/profile")
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Get the current user's profile along with statistics and rating."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        """
        SELECT u.id, u.name, u.email, u.role, u.created_at,
          coalesce(p.username, lower(replace(u.name, ' ', '-'))) AS username,
          coalesce(p.bio, '') AS bio,
          p.avatar_url,
          coalesce(p.travel_style, 'Slow explorer') AS travel_style,
          coalesce(p.interests, '{}') AS interests,
          (SELECT count(*)::int FROM trips WHERE creator_id = u.id) AS trips_count,
          (SELECT count(*)::int FROM traveler_reviews WHERE reviewed_user_id = u.id) AS review_count,
          (SELECT coalesce(round(avg(overall), 1), 5.0) FROM traveler_reviews WHERE reviewed_user_id = u.id) AS rating
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = $1
        """,
        user_uuid,
    )
    return record_to_dict(row)


@router.put("/profile")
async def update_my_profile(
    data: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update profile and optional user name."""
    user_uuid = uuid.UUID(str(current_user["id"]))

    if data.name:
        await db.execute(
            "UPDATE users SET name = $1 WHERE id = $2",
            data.name,
            user_uuid,
        )

    profile_row = await db.fetchrow(
        """
        INSERT INTO user_profiles (user_id, username, bio, avatar_url, travel_style, interests)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          username = coalesce(EXCLUDED.username, user_profiles.username),
          bio = EXCLUDED.bio,
          avatar_url = EXCLUDED.avatar_url,
          travel_style = EXCLUDED.travel_style,
          interests = EXCLUDED.interests,
          updated_at = now()
        RETURNING *
        """,
        user_uuid,
        data.username,
        data.bio,
        data.avatarUrl,
        data.travelStyle,
        data.interests,
    )

    updated_user = await db.fetchrow(
        "SELECT name, email, role FROM users WHERE id = $1",
        user_uuid,
    )

    combined = {
        **record_to_dict(profile_row),
        **record_to_dict(updated_user),
    }
    return combined


@router.get("/privacy")
async def get_my_privacy_settings(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Get the current user's privacy visibility settings."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        "SELECT * FROM user_privacy_settings WHERE user_id = $1",
        user_uuid,
    )
    if not row:
        row = await db.fetchrow(
            "INSERT INTO user_privacy_settings (user_id) VALUES ($1) RETURNING *",
            user_uuid,
        )

    res = record_to_dict(row)
    # Ensure both camelCase and snake_case properties are present
    res["profileVisibility"] = res.get("profile_visibility", "PUBLIC")
    res["travelHistoryVisibility"] = res.get("travel_history_visibility", "PUBLIC")
    res["footprintVisibility"] = res.get("footprint_visibility", "PUBLIC")
    res["reviewsVisibility"] = res.get("reviews_visibility", "PUBLIC")
    return res


@router.put("/privacy")
async def update_my_privacy_settings(
    data: PrivacySettingsUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update privacy visibility settings."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        """
        INSERT INTO user_privacy_settings (
          user_id, profile_visibility, travel_history_visibility, footprint_visibility, reviews_visibility
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          profile_visibility = EXCLUDED.profile_visibility,
          travel_history_visibility = EXCLUDED.travel_history_visibility,
          footprint_visibility = EXCLUDED.footprint_visibility,
          reviews_visibility = EXCLUDED.reviews_visibility
        RETURNING *
        """,
        user_uuid,
        data.profileVisibility,
        data.travelHistoryVisibility,
        data.footprintVisibility,
        data.reviewsVisibility,
    )

    res = record_to_dict(row)
    res["profileVisibility"] = res.get("profile_visibility", "PUBLIC")
    res["travelHistoryVisibility"] = res.get("travel_history_visibility", "PUBLIC")
    res["footprintVisibility"] = res.get("footprint_visibility", "PUBLIC")
    res["reviewsVisibility"] = res.get("reviews_visibility", "PUBLIC")
    return res
