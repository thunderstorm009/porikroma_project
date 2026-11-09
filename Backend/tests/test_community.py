from datetime import datetime
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.security import create_access_token


USER_1_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_2_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
POST_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
COMMENT_1_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
COMMENT_2_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")
COMMENT_3_ID = uuid.UUID("66666666-6666-6666-6666-666666666666")

MOCK_USER_1 = {
    "id": USER_1_ID,
    "email": "traveler1@porikroma.com",
    "name": "Rafi Ahmed",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

MOCK_USER_2 = {
    "id": USER_2_ID,
    "email": "traveler2@porikroma.com",
    "name": "Samira Rahman",
    "role": "TRAVELER",
    "status": "ACTIVE",
    "password_hash": "$2a$10$xyz",
}

AUTH_HEADERS_1 = {
    "Authorization": f"Bearer {create_access_token({'sub': str(USER_1_ID), 'email': 'traveler1@porikroma.com', 'role': 'TRAVELER'})}"
}

AUTH_HEADERS_2 = {
    "Authorization": f"Bearer {create_access_token({'sub': str(USER_2_ID), 'email': 'traveler2@porikroma.com', 'role': 'TRAVELER'})}"
}


# ---------------------------------------------------------------------------
# 1. CREATE POST, LIKE IT, REPLY, AND REPLY TO A REPLY (CHECKLIST)
# ---------------------------------------------------------------------------
def test_create_post_like_reply_and_nested_reply_flow(client: TestClient):
    """
    CHECKLIST TEST:
    Create a post, like it, reply, and reply to a reply with nested reply hierarchy.
    """
    post_row = {
        "id": POST_ID,
        "author_id": USER_1_ID,
        "body": "Quiet morning at Inani Beach. The low tide reveals untouched coral reefs.",
        "visibility": "PUBLIC",
        "created_at": "2025-06-01T10:00:00Z",
    }

    comment_1 = {
        "id": COMMENT_1_ID,
        "post_id": POST_ID,
        "parent_id": None,
        "author_id": USER_2_ID,
        "body": "Did you manage to see the red crabs near the southern end?",
        "created_at": "2025-06-01T10:15:00Z",
        "author_name": "Samira Rahman",
        "author_avatar": "",
    }

    reply_to_comment = {
        "id": COMMENT_2_ID,
        "post_id": POST_ID,
        "parent_id": COMMENT_1_ID,
        "author_id": USER_1_ID,
        "body": "Yes! Early dawn is the best time before tour groups arrive.",
        "created_at": "2025-06-01T10:20:00Z",
        "author_name": "Rafi Ahmed",
        "author_avatar": "",
    }

    reply_to_reply = {
        "id": COMMENT_3_ID,
        "post_id": POST_ID,
        "parent_id": COMMENT_2_ID,
        "author_id": USER_2_ID,
        "body": "Noted! Planning my trip next week.",
        "created_at": "2025-06-01T10:25:00Z",
        "author_name": "Samira Rahman",
        "author_avatar": "",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        # Step 1: Create a post
        def create_post_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_1
            if "INSERT INTO community_posts" in query:
                return post_row
            return None

        mock_fetchrow.side_effect = create_post_side_effect
        res_post = client.post(
            "/api/community/posts",
            json={"body": post_row["body"], "visibility": "PUBLIC"},
            headers=AUTH_HEADERS_1,
        )
        assert res_post.status_code == 201
        post_data = res_post.json()
        assert post_data["id"] == str(POST_ID)
        assert post_data["author_name"] == "Rafi Ahmed"

        # Step 2: Like the post
        def like_post_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_2
            if "SELECT id, author_id FROM community_posts" in query:
                return post_row
            if "SELECT 1 FROM community_reactions" in query:
                return None  # not liked yet
            if "SELECT count(*)::int AS reaction_count" in query:
                return {"reaction_count": 1}
            return None

        mock_fetchrow.side_effect = like_post_side_effect
        res_like = client.post(
            f"/api/community/posts/{POST_ID}/reactions",
            headers=AUTH_HEADERS_2,
        )
        assert res_like.status_code == 200
        like_data = res_like.json()
        assert like_data["liked"] is True
        assert like_data["reaction_count"] == 1

        # Step 3: Reply to the post (root comment)
        def comment_1_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_2
            if "SELECT id, author_id FROM community_posts" in query:
                return post_row
            if "INSERT INTO community_comments" in query:
                return comment_1
            return None

        mock_fetchrow.side_effect = comment_1_side_effect
        res_c1 = client.post(
            f"/api/community/posts/{POST_ID}/comments",
            json={"body": comment_1["body"]},
            headers=AUTH_HEADERS_2,
        )
        assert res_c1.status_code == 201
        c1_data = res_c1.json()
        assert c1_data["id"] == str(COMMENT_1_ID)
        assert c1_data["parent_id"] is None

        # Step 4: Reply to a comment (nested reply)
        def comment_2_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_1
            if "SELECT id, author_id FROM community_posts" in query:
                return post_row
            if "SELECT id, post_id, author_id FROM community_comments" in query:
                return {"id": COMMENT_1_ID, "post_id": POST_ID, "author_id": USER_2_ID}
            if "INSERT INTO community_comments" in query:
                return reply_to_comment
            return None

        mock_fetchrow.side_effect = comment_2_side_effect
        res_c2 = client.post(
            f"/api/community/posts/{POST_ID}/comments",
            json={"body": reply_to_comment["body"], "parentId": str(COMMENT_1_ID)},
            headers=AUTH_HEADERS_1,
        )
        assert res_c2.status_code == 201
        c2_data = res_c2.json()
        assert c2_data["id"] == str(COMMENT_2_ID)
        assert c2_data["parent_id"] == str(COMMENT_1_ID)

        # Step 5: Reply to a reply (second-level nested reply via direct replies endpoint)
        def comment_3_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_2
            if "SELECT id, post_id, author_id FROM community_comments" in query:
                return {"id": COMMENT_2_ID, "post_id": POST_ID, "author_id": USER_1_ID}
            if "INSERT INTO community_comments" in query:
                return reply_to_reply
            return None

        mock_fetchrow.side_effect = comment_3_side_effect
        res_c3 = client.post(
            f"/api/community/comments/{COMMENT_2_ID}/replies",
            json={"body": reply_to_reply["body"]},
            headers=AUTH_HEADERS_2,
        )
        assert res_c3.status_code == 201
        c3_data = res_c3.json()
        assert c3_data["id"] == str(COMMENT_3_ID)
        assert c3_data["parent_id"] == str(COMMENT_2_ID)

        # Step 6: Verify comments tree nesting structure
        mock_fetch.return_value = [comment_1, reply_to_comment, reply_to_reply]
        res_tree = client.get(f"/api/community/posts/{POST_ID}/comments")
        assert res_tree.status_code == 200
        tree = res_tree.json()

        assert len(tree) == 1  # 1 root comment
        root = tree[0]
        assert root["id"] == str(COMMENT_1_ID)
        assert len(root["replies"]) == 1  # 1 reply to root

        level_1_reply = root["replies"][0]
        assert level_1_reply["id"] == str(COMMENT_2_ID)
        assert len(level_1_reply["replies"]) == 1  # 1 reply to reply

        level_2_reply = level_1_reply["replies"][0]
        assert level_2_reply["id"] == str(COMMENT_3_ID)
        assert level_2_reply["body"] == "Noted! Planning my trip next week."


# ---------------------------------------------------------------------------
# 2. LIKE TOGGLING IDEMPOTENCE (CHECKLIST)
# ---------------------------------------------------------------------------
def test_like_toggling_is_idempotent_and_does_not_create_duplicates(client: TestClient):
    """
    CHECKLIST TEST:
    Like toggling is idempotent and does not create duplicates.
    """
    post_row = {
        "id": POST_ID,
        "author_id": USER_1_ID,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        # 1. First toggle (adds reaction)
        def toggle_on_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_2
            if "SELECT id, author_id FROM community_posts" in query:
                return post_row
            if "SELECT 1 FROM community_reactions" in query:
                return None  # not liked yet
            if "SELECT count(*)::int AS reaction_count" in query:
                return {"reaction_count": 1}
            return None

        mock_fetchrow.side_effect = toggle_on_side_effect
        res_1 = client.post(f"/api/community/posts/{POST_ID}/reactions", headers=AUTH_HEADERS_2)
        assert res_1.status_code == 200
        assert res_1.json()["liked"] is True
        assert res_1.json()["reaction_count"] == 1

        # Verify insert query has ON CONFLICT DO NOTHING to prevent duplicates
        insert_calls = [c[0][0] for c in mock_exec.call_args_list if "INSERT INTO community_reactions" in c[0][0]]
        assert len(insert_calls) == 1
        assert "ON CONFLICT (post_id, user_id) DO NOTHING" in insert_calls[0]

        # 2. Second toggle (removes reaction)
        def toggle_off_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_2
            if "SELECT id, author_id FROM community_posts" in query:
                return post_row
            if "SELECT 1 FROM community_reactions" in query:
                return {"1": 1}  # already liked
            if "SELECT count(*)::int AS reaction_count" in query:
                return {"reaction_count": 0}
            return None

        mock_fetchrow.side_effect = toggle_off_side_effect
        res_2 = client.post(f"/api/community/posts/{POST_ID}/reactions", headers=AUTH_HEADERS_2)
        assert res_2.status_code == 200
        assert res_2.json()["liked"] is False
        assert res_2.json()["reaction_count"] == 0

        # Verify delete query executed
        delete_calls = [c[0][0] for c in mock_exec.call_args_list if "DELETE FROM community_reactions" in c[0][0]]
        assert len(delete_calls) == 1

        # 3. Third toggle via /like alias (re-adds reaction cleanly)
        mock_fetchrow.side_effect = toggle_on_side_effect
        res_3 = client.post(f"/api/community/posts/{POST_ID}/like", headers=AUTH_HEADERS_2)
        assert res_3.status_code == 200
        assert res_3.json()["liked"] is True
        assert res_3.json()["reaction_count"] == 1


# ---------------------------------------------------------------------------
# 3. COMMUNITY FEED & ENGAGEMENT METRICS
# ---------------------------------------------------------------------------
def test_list_community_posts_feed(client: TestClient):
    """Retrieve discussion feed with reaction count, comment count, and liked_by_me status."""
    sample_posts = [
        {
            "id": POST_ID,
            "author_id": USER_1_ID,
            "body": "Essential advice for visiting Ratargul during monsoon.",
            "visibility": "PUBLIC",
            "created_at": "2025-06-01T12:00:00Z",
            "author_name": "Rafi Ahmed",
            "author_avatar": "https://example.com/rafi.jpg",
            "reaction_count": 5,
            "like_count": 5,
            "comment_count": 3,
            "liked_by_me": True,
        }
    ]

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch:

        mock_fetchrow.return_value = MOCK_USER_1
        mock_fetch.return_value = sample_posts

        res = client.get("/api/community/posts", headers=AUTH_HEADERS_1)
        assert res.status_code == 200
        posts = res.json()
        assert len(posts) == 1
        assert posts[0]["id"] == str(POST_ID)
        assert posts[0]["reaction_count"] == 5
        assert posts[0]["like_count"] == 5
        assert posts[0]["comment_count"] == 3
        assert posts[0]["liked_by_me"] is True


# ---------------------------------------------------------------------------
# 4. DELETION PERMISSIONS
# ---------------------------------------------------------------------------
def test_post_deletion_permissions(client: TestClient):
    """Only post author or admin can delete post."""
    post_row = {
        "id": POST_ID,
        "author_id": USER_1_ID,
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        def fetchrow_side_effect(user_obj):
            def side_effect(query, *args):
                if "FROM users" in query:
                    return user_obj
                if "FROM community_posts" in query:
                    return post_row
                return None
            return side_effect

        # User 2 (not author) receives 403
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_USER_2)
        res_unauth = client.delete(f"/api/community/posts/{POST_ID}", headers=AUTH_HEADERS_2)
        assert res_unauth.status_code == 403

        # User 1 (author) succeeds
        mock_fetchrow.side_effect = fetchrow_side_effect(MOCK_USER_1)
        res_auth = client.delete(f"/api/community/posts/{POST_ID}", headers=AUTH_HEADERS_1)
        assert res_auth.status_code == 200
        assert res_auth.json() == {"success": True}
