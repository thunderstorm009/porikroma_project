from datetime import datetime
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from starlette.testclient import TestClient
from app.db import db
from app.services.ai import generate_reply
from app.services.security import create_access_token


USER_1_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_2_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
CONVO_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
MSG_USER_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
MSG_AI_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")

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
# 1. REPRODUCE OLD RULE-BASED RESPONSES (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_replies_match_old_backend_for_same_prompts():
    """
    CHECKLIST TEST:
    Replies match the old backend for Cox's Bazar, Sylhet, Bandarban, Sajek, budget, and fallback.
    """
    # 1. Cox's Bazar / Beach / Sea
    cox_reply = generate_reply("Can you plan a beach trip to Cox's Bazar?")
    assert "curated coastal escape plan for Cox’s Bazar" in cox_reply
    assert "Mermaid Eco Resort" in cox_reply
    assert "Inani Coral Beach" in cox_reply
    assert "৳8,500 – ৳15,000" in cox_reply

    # 2. Sylhet / Tea / Sreemangal
    sylhet_reply = generate_reply("I want to visit the tea gardens in Sreemangal and Sylhet.")
    assert "slow, refreshing journey into Sylhet & Sreemangal" in sylhet_reply
    assert "Parabat Express train" in sylhet_reply
    assert "Lawachara Rainforest" in sylhet_reply
    assert "Lalakhal" in sylhet_reply
    assert "৳7,500 – ৳12,000" in sylhet_reply

    # 3. Bandarban / Trek / Hill / Keokradong
    bandarban_reply = generate_reply("Looking for a high trek in Bandarban to Keokradong.")
    assert "Bandarban adventure blueprint" in bandarban_reply
    assert "Army checkpoints" in bandarban_reply
    assert "Boga Lake" in bandarban_reply
    assert "৳12,000 – ৳18,000" in bandarban_reply

    # 4. Sajek / Cloud
    sajek_reply = generate_reply("Tell me about the clouds at Sajek Valley.")
    assert "Sajek Valley cloud-country guide" in sajek_reply
    assert "Khagrachari night bus" in sajek_reply
    assert "Konglak Hill" in sajek_reply
    assert "৳5,800 – ৳8,500" in sajek_reply

    # 5. Budget / Cost / Money
    budget_reply = generate_reply("What is the typical budget and cost for Bangladesh travel?")
    assert "balanced BDT budget breakdown" in budget_reply
    assert "Transport: 20-25%" in budget_reply
    assert "Accommodation: 40%" in budget_reply
    assert "Local food & guides: 25%" in budget_reply

    # 6. Fallback general prompt
    fallback_reply = generate_reply("Any general recommendations?")
    assert "That sounds like a wonderful travel spark!" in fallback_reply
    assert "slow, respectful itinerary" in fallback_reply


def test_llm_swap_point_accepts_conversation_history():
    """
    CHECKLIST TEST:
    The LLM swap point is one function: generate_reply(history).
    It extracts the latest user prompt from conversation history.
    """
    history = [
        {"sender": "USER", "body": "Hello!"},
        {"sender": "ASSISTANT", "body": "Welcome! Where would you like to travel?"},
        {"sender": "USER", "body": "I'd like to see the clouds in Sajek"},
    ]
    reply = generate_reply(history)
    assert "Sajek Valley cloud-country guide" in reply


# ---------------------------------------------------------------------------
# 2. SESSIONS PERSISTENCE & HISTORY RELOAD (CHECKLIST TEST)
# ---------------------------------------------------------------------------
def test_sessions_persist_and_history_reloads(client: TestClient):
    """
    CHECKLIST TEST:
    Sessions persist and history reloads.
    """
    convo_row = {
        "id": CONVO_ID,
        "user_id": USER_1_ID,
        "title": "Sylhet 4-day slow route",
        "created_at": "2025-06-01T10:00:00Z",
    }

    user_msg_row = {
        "id": MSG_USER_ID,
        "conversation_id": CONVO_ID,
        "sender": "USER",
        "body": "What should I explore in Sylhet and Sreemangal?",
        "created_at": "2025-06-01T10:01:00Z",
    }

    ai_msg_row = {
        "id": MSG_AI_ID,
        "conversation_id": CONVO_ID,
        "sender": "ASSISTANT",
        "body": generate_reply(user_msg_row["body"]),
        "created_at": "2025-06-01T10:01:01Z",
    }

    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch.object(db, "fetch", new_callable=AsyncMock) as mock_fetch, \
         patch.object(db, "execute", new_callable=AsyncMock) as mock_exec:

        # 1. Create session
        def create_convo_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_1
            if "INSERT INTO ai_conversations" in query:
                return convo_row
            return None

        mock_fetchrow.side_effect = create_convo_side_effect
        res_create = client.post(
            "/api/ai/conversations",
            json={"title": convo_row["title"]},
            headers=AUTH_HEADERS_1,
        )
        assert res_create.status_code == 201
        data = res_create.json()
        assert data["id"] == str(CONVO_ID)
        assert data["title"] == "Sylhet 4-day slow route"

        # 2. List sessions
        mock_fetch.return_value = [convo_row]
        res_list = client.get("/api/ai/conversations", headers=AUTH_HEADERS_1)
        assert res_list.status_code == 200
        convos = res_list.json()
        assert len(convos) == 1
        assert convos[0]["id"] == str(CONVO_ID)

        # 3. Send message and get AI synthesized response
        def send_msg_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_1
            if "SELECT 1 FROM ai_conversations" in query:
                return {"1": 1}
            if "INSERT INTO ai_messages" in query and "'USER'" in query:
                return user_msg_row
            if "INSERT INTO ai_messages" in query and "'ASSISTANT'" in query:
                return ai_msg_row
            return None

        mock_fetchrow.side_effect = send_msg_side_effect
        mock_fetch.return_value = []  # No prior messages in history yet

        res_send = client.post(
            f"/api/ai/conversations/{CONVO_ID}/messages",
            json={"body": user_msg_row["body"]},
            headers=AUTH_HEADERS_1,
        )
        assert res_send.status_code == 201
        exchange = res_send.json()
        assert exchange["userMessage"]["body"] == user_msg_row["body"]
        assert "slow, refreshing journey into Sylhet & Sreemangal" in exchange["assistantMessage"]["body"]

        # 4. Reload history
        def history_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_1
            if "SELECT 1 FROM ai_conversations" in query:
                return {"1": 1}
            return None

        mock_fetchrow.side_effect = history_side_effect
        mock_fetch.return_value = [user_msg_row, ai_msg_row]

        res_history = client.get(
            f"/api/ai/conversations/{CONVO_ID}/messages",
            headers=AUTH_HEADERS_1,
        )
        assert res_history.status_code == 200
        history_msgs = res_history.json()
        assert len(history_msgs) == 2
        assert history_msgs[0]["sender"] == "USER"
        assert history_msgs[1]["sender"] == "ASSISTANT"

        # 5. Delete session
        res_del = client.delete(
            f"/api/ai/conversations/{CONVO_ID}",
            headers=AUTH_HEADERS_1,
        )
        assert res_del.status_code == 200
        assert res_del.json() == {"success": True}
        mock_exec.assert_awaited()


def test_ai_conversation_ownership_isolation(client: TestClient):
    """User cannot access or send messages to another user's conversation."""
    with patch.object(db, "fetchrow", new_callable=AsyncMock) as mock_fetchrow:
        def fetchrow_side_effect(query, *args):
            if "FROM users" in query:
                return MOCK_USER_2
            if "SELECT 1 FROM ai_conversations" in query:
                return None  # not owned by user 2
            return None

        mock_fetchrow.side_effect = fetchrow_side_effect

        res = client.get(
            f"/api/ai/conversations/{CONVO_ID}/messages",
            headers=AUTH_HEADERS_2,
        )
        assert res.status_code == 404
        assert res.json()["error"] == "Conversation not found"
