from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.community import CommentCreateRequest, PostCreateRequest, ReplyCreateRequest
from app.serializers import record_to_dict

router = APIRouter(tags=["Community Discussions, Posts & Threaded Comments"])


# -------------------------------------------------------------
# 1. DISCUSSION FEED & POSTS CRUD
# -------------------------------------------------------------
@router.get("/api/community/posts")
async def list_community_posts(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve community discussion feed with author profiles, reaction counts, and comment counts."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        """
        SELECT p.*, u.name AS author_name, coalesce(up.avatar_url, '') AS author_avatar,
          count(DISTINCT r.user_id)::int AS reaction_count,
          count(DISTINCT r.user_id)::int AS like_count,
          count(DISTINCT c.id)::int AS comment_count,
          EXISTS (SELECT 1 FROM community_reactions WHERE post_id = p.id AND user_id = $1) AS liked_by_me
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN user_profiles up ON up.user_id = p.author_id
        LEFT JOIN community_reactions r ON r.post_id = p.id
        LEFT JOIN community_comments c ON c.post_id = p.id
        GROUP BY p.id, u.name, up.avatar_url
        ORDER BY p.created_at DESC
        """,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.post("/api/community/posts", status_code=status.HTTP_201_CREATED)
async def create_community_post(
    data: PostCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Publish a new traveler discussion or story reflection."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        """
        INSERT INTO community_posts (author_id, body, visibility)
        VALUES ($1, $2, $3)
        RETURNING *
        """,
        user_uuid,
        data.body,
        data.visibility,
    )
    post_dict = record_to_dict(row)
    post_dict["author_name"] = current_user.get("name", "Traveler")
    post_dict["author_avatar"] = current_user.get("avatar_url", "")
    post_dict["reaction_count"] = 0
    post_dict["like_count"] = 0
    post_dict["comment_count"] = 0
    post_dict["liked_by_me"] = False
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=post_dict)


@router.get("/api/community/posts/{id}")
async def get_community_post(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve a single community post with engagement metrics."""
    try:
        post_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    row = await db.fetchrow(
        """
        SELECT p.*, u.name AS author_name, coalesce(up.avatar_url, '') AS author_avatar,
          count(DISTINCT r.user_id)::int AS reaction_count,
          count(DISTINCT r.user_id)::int AS like_count,
          count(DISTINCT c.id)::int AS comment_count,
          EXISTS (SELECT 1 FROM community_reactions WHERE post_id = p.id AND user_id = $1) AS liked_by_me
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN user_profiles up ON up.user_id = p.author_id
        LEFT JOIN community_reactions r ON r.post_id = p.id
        LEFT JOIN community_comments c ON c.post_id = p.id
        WHERE p.id = $2
        GROUP BY p.id, u.name, up.avatar_url
        """,
        user_uuid,
        post_uuid,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Post not found"})
    return record_to_dict(row)


@router.delete("/api/community/posts/{id}")
async def delete_community_post(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a community post. Permitted for post author or ADMIN."""
    try:
        post_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    existing = await db.fetchrow("SELECT id, author_id FROM community_posts WHERE id = $1", post_uuid)
    if not existing:
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    if existing["author_id"] != user_uuid and current_user["role"] != "ADMIN":
        return JSONResponse(status_code=403, content={"error": "You can only delete your own posts"})

    await db.execute(
        "DELETE FROM community_posts WHERE id = $1 AND (author_id = $2 OR $3 = 'ADMIN')",
        post_uuid,
        user_uuid,
        current_user["role"],
    )
    return {"success": True}


# -------------------------------------------------------------
# 2. LIKES & REACTIONS (IDEMPOTENT TOGGLING)
# -------------------------------------------------------------
@router.post("/api/community/posts/{id}/reactions")
@router.post("/api/community/posts/{id}/like")
async def toggle_post_like(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Toggle like on a community post idempotently without duplicate entries."""
    try:
        post_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    post = await db.fetchrow("SELECT id, author_id FROM community_posts WHERE id = $1", post_uuid)
    if not post:
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    existing = await db.fetchrow(
        "SELECT 1 FROM community_reactions WHERE post_id = $1 AND user_id = $2",
        post_uuid,
        user_uuid,
    )

    if existing:
        await db.execute(
            "DELETE FROM community_reactions WHERE post_id = $1 AND user_id = $2",
            post_uuid,
            user_uuid,
        )
        liked = False
    else:
        await db.execute(
            """
            INSERT INTO community_reactions (post_id, user_id, reaction)
            VALUES ($1, $2, 'LIKE')
            ON CONFLICT (post_id, user_id) DO NOTHING
            """,
            post_uuid,
            user_uuid,
        )
        liked = True

        # Send notification to post author if not liking own post
        if post["author_id"] != user_uuid:
            try:
                await db.execute(
                    """
                    INSERT INTO notifications (user_id, type, detail, link)
                    VALUES ($1, $2, $3, $4)
                    """,
                    post["author_id"],
                    "POST_LIKE",
                    f"{current_user.get('name', 'Someone')} liked your discussion post.",
                    "/community",
                )
            except Exception:
                pass

    count_row = await db.fetchrow(
        "SELECT count(*)::int AS reaction_count FROM community_reactions WHERE post_id = $1",
        post_uuid,
    )
    reaction_count = count_row["reaction_count"] if count_row else 0

    return {
        "liked": liked,
        "reaction_count": reaction_count,
        "like_count": reaction_count,
    }


# -------------------------------------------------------------
# 3. COMMENTS & THREADED NESTED REPLIES
# -------------------------------------------------------------
@router.get("/api/community/posts/{id}/comments")
async def list_post_comments(
    id: str,
    db: Database = Depends(get_db),
):
    """Retrieve comments for a post organized into a nested threaded reply tree."""
    try:
        post_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    rows = await db.fetch(
        """
        SELECT c.*, u.name AS author_name, coalesce(up.avatar_url, '') AS author_avatar
        FROM community_comments c
        JOIN users u ON u.id = c.author_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC
        """,
        post_uuid,
    )

    comments_map = {}
    roots = []

    for r in rows:
        d = record_to_dict(r)
        d["replies"] = []
        comments_map[str(d["id"])] = d

    for item in comments_map.values():
        p_id = item.get("parent_id")
        if p_id and str(p_id) in comments_map:
            comments_map[str(p_id)]["replies"].append(item)
        else:
            roots.append(item)

    return roots


@router.post("/api/community/posts/{id}/comments", status_code=status.HTTP_201_CREATED)
async def create_post_comment(
    id: str,
    data: CommentCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Create a comment or reply under a community post, with optional parent_id for reply nesting."""
    try:
        post_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    post = await db.fetchrow("SELECT id, author_id FROM community_posts WHERE id = $1", post_uuid)
    if not post:
        return JSONResponse(status_code=404, content={"error": "Post not found"})

    parent_uuid = None
    if data.parentId:
        try:
            parent_uuid = uuid.UUID(data.parentId)
        except (ValueError, TypeError):
            return JSONResponse(status_code=400, content={"error": "Invalid parent comment ID"})

        parent_comment = await db.fetchrow(
            "SELECT id, post_id, author_id FROM community_comments WHERE id = $1",
            parent_uuid,
        )
        if not parent_comment:
            return JSONResponse(status_code=404, content={"error": "Parent comment not found"})
        if parent_comment["post_id"] != post_uuid:
            return JSONResponse(status_code=400, content={"error": "Parent comment does not belong to this post"})

    row = await db.fetchrow(
        """
        INSERT INTO community_comments (post_id, parent_id, author_id, body)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        post_uuid,
        parent_uuid,
        user_uuid,
        data.body.strip(),
    )

    # Notify author
    try:
        if parent_uuid:
            if parent_comment["author_id"] != user_uuid:
                await db.execute(
                    """
                    INSERT INTO notifications (user_id, type, detail, link)
                    VALUES ($1, $2, $3, $4)
                    """,
                    parent_comment["author_id"],
                    "COMMENT_REPLY",
                    f"{current_user.get('name', 'Someone')} replied to your comment.",
                    "/community",
                )
        else:
            if post["author_id"] != user_uuid:
                await db.execute(
                    """
                    INSERT INTO notifications (user_id, type, detail, link)
                    VALUES ($1, $2, $3, $4)
                    """,
                    post["author_id"],
                    "POST_COMMENT",
                    f"{current_user.get('name', 'Someone')} replied to your discussion post.",
                    "/community",
                )
    except Exception:
        pass

    result = record_to_dict(row)
    result["author_name"] = current_user.get("name", "Traveler")
    result["author_avatar"] = current_user.get("avatar_url", "")
    result["replies"] = []
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=result)


@router.post("/api/community/comments/{id}/replies", status_code=status.HTTP_201_CREATED)
@router.post("/api/community/posts/{post_id}/comments/{id}/replies", status_code=status.HTTP_201_CREATED)
async def create_nested_reply(
    id: str,
    data: ReplyCreateRequest,
    post_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Directly reply to a comment or nested reply."""
    try:
        parent_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Comment not found"})

    parent_comment = await db.fetchrow(
        "SELECT id, post_id, author_id FROM community_comments WHERE id = $1",
        parent_uuid,
    )
    if not parent_comment:
        return JSONResponse(status_code=404, content={"error": "Parent comment not found"})

    row = await db.fetchrow(
        """
        INSERT INTO community_comments (post_id, parent_id, author_id, body)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        parent_comment["post_id"],
        parent_uuid,
        user_uuid,
        data.body.strip(),
    )

    try:
        if parent_comment["author_id"] != user_uuid:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                parent_comment["author_id"],
                "COMMENT_REPLY",
                f"{current_user.get('name', 'Someone')} replied to your comment.",
                "/community",
            )
    except Exception:
        pass

    result = record_to_dict(row)
    result["author_name"] = current_user.get("name", "Traveler")
    result["author_avatar"] = current_user.get("avatar_url", "")
    result["replies"] = []
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=result)


@router.delete("/api/community/comments/{id}")
async def delete_community_comment(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a comment or reply."""
    try:
        comment_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Comment not found"})

    existing = await db.fetchrow("SELECT id, author_id FROM community_comments WHERE id = $1", comment_uuid)
    if not existing:
        return JSONResponse(status_code=404, content={"error": "Comment not found"})

    if existing["author_id"] != user_uuid and current_user["role"] != "ADMIN":
        return JSONResponse(status_code=403, content={"error": "You can only delete your own comments"})

    await db.execute(
        "DELETE FROM community_comments WHERE id = $1 AND (author_id = $2 OR $3 = 'ADMIN')",
        comment_uuid,
        user_uuid,
        current_user["role"],
    )
    return {"success": True}
