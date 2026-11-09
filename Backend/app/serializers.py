from datetime import date, datetime, timezone
import json
from typing import Any
import uuid
from fastapi.responses import JSONResponse


class PorikromaJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder matching legacy Node/Fastify formatting."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, datetime):
            if obj.tzinfo is None or obj.tzinfo == timezone.utc:
                return (
                    obj.strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4] + "Z"
                    if obj.microsecond
                    else obj.strftime("%Y-%m-%dT%H:%M:%SZ")
                )
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        if hasattr(obj, "keys") and callable(obj.keys):
            return dict(obj)
        return super().default(obj)


class PorikromaJSONResponse(JSONResponse):
    """FastAPI JSONResponse that applies PorikromaJSONEncoder."""

    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            cls=PorikromaJSONEncoder,
        ).encode("utf-8")


def serialize_value(val: Any) -> Any:
    """Recursively convert UUID, date, and datetime values to JSON-compatible types."""
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        if val.tzinfo is None or val.tzinfo == timezone.utc:
            return (
                val.strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4] + "Z"
                if val.microsecond
                else val.strftime("%Y-%m-%dT%H:%M:%SZ")
            )
        return val.isoformat()
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, list):
        return [serialize_value(item) for item in val]
    if isinstance(val, dict):
        return {k: (json.loads(v) if k == "answers" and isinstance(v, str) else serialize_value(v)) for k, v in val.items()}
    if hasattr(val, "keys") and callable(val.keys):
        return {k: (json.loads(val[k]) if k == "answers" and isinstance(val[k], str) else serialize_value(val[k])) for k in val.keys()}
    return val


def record_to_dict(record: Any) -> Any:
    """Convert asyncpg.Record or dict or list to plain dict with serialized dates & UUIDs."""
    if record is None:
        return None
    if isinstance(record, list):
        return [record_to_dict(r) for r in record]
    return serialize_value(record)
