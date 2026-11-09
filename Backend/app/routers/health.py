from fastapi import APIRouter, Response, status
from app.db import db
from app.schemas.health import HealthStatusResponse, ReadinessResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/api/health",
    response_model=HealthStatusResponse,
    response_model_exclude_none=True,
    summary="Health check endpoint",
    description="Checks the database connection and returns status ok.",
)
async def api_health():
    """Check database connection and return status ok."""
    await db.check_connection()
    return {"status": "ok"}


@router.get(
    "/health",
    summary="Legacy health status",
    description="Returns status ok with database availability status.",
)
async def legacy_health(response: Response):
    """Legacy /health endpoint compatible with Fastify backend."""
    is_ready = await db.check_connection()
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "database": "unavailable"}
    return {"status": "ok", "database": "ready"}


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    response_model_exclude_none=True,
    summary="Legacy readiness check",
    description="Returns readiness status based on database availability.",
)
async def legacy_ready(response: Response):
    """Legacy /ready endpoint compatible with Fastify backend."""
    is_ready = await db.check_connection()
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "database": "unavailable"}
    return {"status": "ready"}
