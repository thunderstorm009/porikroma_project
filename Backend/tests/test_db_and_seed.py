import asyncio
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import asyncpg
import pytest
from app.db import Database
from app.serializers import PorikromaJSONEncoder, PorikromaJSONResponse, record_to_dict, serialize_value
from seed import seed


def test_serialization_uuid_and_datetimes():
    """Verify UUID and datetime values serialize to ISO strings matching legacy Fastify."""
    sample_uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    sample_date = date(2025, 5, 18)
    sample_dt = datetime(2025, 5, 18, 14, 30, 0, tzinfo=timezone.utc)

    # Direct serializer
    assert serialize_value(sample_uuid) == "12345678-1234-5678-1234-567812345678"
    assert serialize_value(sample_date) == "2025-05-18"
    assert serialize_value(sample_dt) == "2025-05-18T14:30:00Z"

    # Dict / list serializer
    raw_data = {
        "id": sample_uuid,
        "trip_id": sample_uuid,
        "created_at": sample_dt,
        "start_date": sample_date,
        "nested": [{"updated_at": sample_dt}],
    }
    converted = record_to_dict(raw_data)
    assert converted["id"] == "12345678-1234-5678-1234-567812345678"
    assert converted["created_at"] == "2025-05-18T14:30:00Z"
    assert converted["start_date"] == "2025-05-18"
    assert converted["nested"][0]["updated_at"] == "2025-05-18T14:30:00Z"

    # PorikromaJSONResponse rendering
    resp = PorikromaJSONResponse(content=raw_data)
    body = resp.body.decode("utf-8")
    assert '"id":"12345678-1234-5678-1234-567812345678"' in body
    assert '"start_date":"2025-05-18"' in body
    assert '"created_at":"2025-05-18T14:30:00Z"' in body


def test_init_schema_applies_schema_sql_idempotently():
    """Verify init_schema reads schema.sql and calls execute."""
    async def _run():
        test_db = Database()
        mock_conn = AsyncMock()
        mock_pool = MagicMock()

        acquire_ctx = AsyncMock()
        acquire_ctx.__aenter__.return_value = mock_conn
        acquire_ctx.__aexit__.return_value = None
        mock_pool.acquire.return_value = acquire_ctx
        test_db.pool = mock_pool

        success = await test_db.init_schema()
        assert success is True
        mock_conn.execute.assert_awaited_once()

        executed_sql = mock_conn.execute.call_args[0][0]
        assert "CREATE TABLE IF NOT EXISTS users" in executed_sql
        assert "CREATE TABLE IF NOT EXISTS trips" in executed_sql
        assert "CREATE TABLE IF NOT EXISTS destinations" in executed_sql

    asyncio.run(_run())


def test_seed_runs_twice_without_errors_or_duplicates():
    """Verify seed logic handles first run and second run idempotently without duplicating."""
    async def _run():
        mock_conn = AsyncMock()

        # Track simulated database state to test idempotency
        db_state = {
            "users": {},
            "destinations": {},
            "trips": {},
            "groups": {},
            "tours": {},
            "departures": {},
            "achievements": {},
            "posts": {},
            "notifications": set(),
            "ai_convos": {},
        }

        async def mock_fetchrow(query, *args):
            # 1. users insert
            if "INSERT INTO users" in query:
                email = args[1]
                user_id = db_state["users"].get(email, uuid.uuid4())
                db_state["users"][email] = user_id
                return {"id": user_id, "email": email}

            # 2. destinations check
            if "SELECT id FROM destinations WHERE name = $1" in query:
                name = args[0]
                if name in db_state["destinations"]:
                    return {"id": db_state["destinations"][name]}
                return None

            # 3. destinations insert
            if "INSERT INTO destinations" in query:
                name = args[0]
                dest_id = uuid.uuid4()
                db_state["destinations"][name] = dest_id
                return {"id": dest_id}

            # 4. trips check
            if "SELECT id FROM trips WHERE creator_id = $1 AND name = $2" in query:
                key = (args[0], args[1])
                if key in db_state["trips"]:
                    return {"id": db_state["trips"][key]}
                return None

            # 5. trips insert
            if "INSERT INTO trips" in query:
                key = (args[0], args[2])
                trip_id = uuid.uuid4()
                db_state["trips"][key] = trip_id
                return {"id": trip_id}

            # 6. groups check & insert
            if "SELECT id FROM groups WHERE trip_id = $1 AND title = $2" in query:
                key = (args[0], args[1])
                if key in db_state["groups"]:
                    return {"id": db_state["groups"][key]}
                return None

            if "INSERT INTO groups" in query:
                key = (args[0], args[2])
                group_id = uuid.uuid4()
                db_state["groups"][key] = group_id
                return {"id": group_id}

            # 7. tours check & insert
            if "SELECT id FROM tours WHERE planner_id = $1 AND title = $2" in query:
                key = (args[0], args[1])
                if key in db_state["tours"]:
                    return {"id": db_state["tours"][key]}
                return None

            if "INSERT INTO tours" in query:
                key = (args[0], args[2])
                tour_id = uuid.uuid4()
                db_state["tours"][key] = tour_id
                return {"id": tour_id}

            # 8. departures check & insert
            if "SELECT id FROM tour_departures WHERE tour_id = $1" in query:
                key = (args[0], args[1], args[2])
                if key in db_state["departures"]:
                    return {"id": db_state["departures"][key]}
                return None

            if "INSERT INTO tour_departures" in query:
                key = (args[0], args[1], args[2])
                dep_id = uuid.uuid4()
                db_state["departures"][key] = dep_id
                return {"id": dep_id}

            # 9. community posts check & insert
            if "SELECT id FROM community_posts WHERE author_id = $1" in query:
                key = (args[0], args[1])
                if key in db_state["posts"]:
                    return {"id": db_state["posts"][key]}
                return None

            if "INSERT INTO community_posts" in query:
                key = (args[0], args[1])
                post_id = uuid.uuid4()
                db_state["posts"][key] = post_id
                return {"id": post_id}

            # 10. notifications check
            if "SELECT id FROM notifications" in query:
                key = (args[0], args[1], args[2])
                if key in db_state["notifications"]:
                    return {"id": uuid.uuid4()}
                db_state["notifications"].add(key)
                return None

            # 11. AI conversation check & insert
            if "SELECT id FROM ai_conversations WHERE user_id = $1" in query:
                key = (args[0], args[1])
                if key in db_state["ai_convos"]:
                    return {"id": db_state["ai_convos"][key]}
                return None

            if "INSERT INTO ai_conversations" in query:
                key = (args[0], args[1] if len(args) > 1 else "A quiet weekend in Sylhet")
                convo_id = uuid.uuid4()
                db_state["ai_convos"][key] = convo_id
                return {"id": convo_id}

            return None

        async def mock_fetch(query, *args):
            if "SELECT id, code FROM travel_achievements" in query:
                return [{"id": uuid.uuid4(), "code": f"ACH_{i}"} for i in range(6)]
            return []

        mock_conn.fetchrow.side_effect = mock_fetchrow
        mock_conn.fetch.side_effect = mock_fetch
        mock_conn.execute.return_value = "OK"

        with patch("asyncpg.connect", new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value = mock_conn

            # RUN 1: Should seed completely
            await seed("postgres://dummy:5432/porikroma")
            initial_users_count = len(db_state["users"])
            initial_dest_count = len(db_state["destinations"])
            initial_trips_count = len(db_state["trips"])
            initial_groups_count = len(db_state["groups"])
            initial_tours_count = len(db_state["tours"])

            assert initial_users_count == 4
            assert initial_dest_count == 7
            assert initial_trips_count == 3
            assert initial_groups_count == 2
            assert initial_tours_count == 2

            # RUN 2: Must run cleanly without throwing error or adding duplicate records
            await seed("postgres://dummy:5432/porikroma")
            assert len(db_state["users"]) == initial_users_count
            assert len(db_state["destinations"]) == initial_dest_count
            assert len(db_state["trips"]) == initial_trips_count
            assert len(db_state["groups"]) == initial_groups_count
            assert len(db_state["tours"]) == initial_tours_count

    asyncio.run(_run())
