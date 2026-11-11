from typing import List
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.ai import ConversationCreateRequest, MessageCreateRequest
from app.serializers import record_to_dict
from app.services.ai import generate_reply, generate_reply_async
from app.services.rate_limiter import ai_rate_limiter

router = APIRouter(tags=["AI Travel Planner & Assistant"])


# -------------------------------------------------------------
# 1. SESSIONS / CONVERSATIONS CRUD
# -------------------------------------------------------------
@router.get("/api/ai/conversations")
async def list_ai_conversations(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve all persistent travel planning sessions for the authenticated user."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        """
        SELECT * FROM ai_conversations
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.post("/api/ai/conversations", status_code=status.HTTP_201_CREATED)
async def create_ai_conversation(
    data: ConversationCreateRequest = ConversationCreateRequest(),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Initialize a new persistent travel planning session."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    row = await db.fetchrow(
        """
        INSERT INTO ai_conversations (user_id, title)
        VALUES ($1, $2)
        RETURNING *
        """,
        user_uuid,
        data.title,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@router.delete("/api/ai/conversations/{id}")
async def delete_ai_conversation(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a travel planning session and all its messages."""
    try:
        convo_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Conversation not found"})

    await db.execute(
        "DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2",
        convo_uuid,
        user_uuid,
    )
    return {"success": True}


# -------------------------------------------------------------
# 2. MESSAGES & ASSISTANT SYNTHESIS
# -------------------------------------------------------------
@router.get("/api/ai/conversations/{id}/messages")
async def get_ai_conversation_messages(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Reload conversation message history in chronological order."""
    try:
        convo_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Conversation not found"})

    owned = await db.fetchrow(
        "SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2",
        convo_uuid,
        user_uuid,
    )
    if not owned:
        return JSONResponse(status_code=404, content={"error": "Conversation not found"})

    rows = await db.fetch(
        """
        SELECT * FROM ai_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        """,
        convo_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.post("/api/ai/conversations/{id}/messages", status_code=status.HTTP_201_CREATED)
async def send_ai_message(
    id: str,
    data: MessageCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Send a traveler prompt, synthesize recommendations via generate_reply(), and persist exchanges."""
    try:
        convo_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Conversation not found"})

    owned = await db.fetchrow(
        "SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2",
        convo_uuid,
        user_uuid,
    )
    if not owned:
        return JSONResponse(status_code=404, content={"error": "Conversation not found"})

    # Rate limiting: 10 requests per 60 seconds per user
    is_allowed, retry_after = ai_rate_limiter.check(str(user_uuid))
    if not is_allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded. Please wait a moment before sending another message.",
                "retryAfter": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )

    # 1. Load message history to supply to Gemini/assistant generator
    past_rows = await db.fetch(
        """
        SELECT sender, body, created_at FROM ai_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        """,
        convo_uuid,
    )
    history = [record_to_dict(r) for r in past_rows] + [{"sender": "USER", "body": data.body}]

    # 2. Insert user message
    user_row = await db.fetchrow(
        """
        INSERT INTO ai_messages (conversation_id, sender, body)
        VALUES ($1, 'USER', $2)
        RETURNING *
        """,
        convo_uuid,
        data.body,
    )

    # 3. Generate response using Gemini API or rule-based fallback
    reply_text = await generate_reply_async(history)

    # 4. Insert assistant message
    ai_row = await db.fetchrow(
        """
        INSERT INTO ai_messages (conversation_id, sender, body)
        VALUES ($1, 'ASSISTANT', $2)
        RETURNING *
        """,
        convo_uuid,
        reply_text,
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "userMessage": record_to_dict(user_row),
            "assistantMessage": record_to_dict(ai_row),
        },
    )
