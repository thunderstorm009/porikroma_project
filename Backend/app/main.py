from contextlib import asynccontextmanager
import logging
import asyncpg
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uvicorn
from app.config import settings
from app.db import db
from app.routers import auth, destinations, expenses, groups, health, notifications, reviews, trips, users
from app.serializers import PorikromaJSONResponse

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager to initialize and cleanup resources."""
    # Startup: attempt database connection and apply schema
    connected = await db.connect()
    if connected:
        try:
            await db.init_schema()
        except Exception as exc:
            logger.error("Schema application on startup encountered error: %s", exc)
    yield
    # Shutdown: close database pool
    await db.disconnect()


app = FastAPI(
    title="Porikroma API",
    description="FastAPI backend for Porikroma travel planning platform",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=PorikromaJSONResponse,
)

# -------------------------------------------------------------
# GLOBAL EXCEPTION HANDLERS
# -------------------------------------------------------------

def _format_validation_errors(errors: list) -> list:
    """Format Pydantic validation errors into JSON-safe dictionaries."""
    formatted = []
    for err in errors:
        item = {}
        for k, v in err.items():
            if k == "ctx":
                item[k] = (
                    {str(ck): str(cv) for ck, cv in v.items()}
                    if isinstance(v, dict)
                    else str(v)
                )
            elif k == "input" and not isinstance(
                v, (str, int, float, bool, list, dict, type(None))
            ):
                item[k] = str(v)
            else:
                item[k] = v
        formatted.append(item)
    return formatted


# 1. Validation Errors (Pydantic / Request body & params) -> 400 Bad Request
@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "Validation failed",
            "details": _format_validation_errors(exc.errors()),
        },
    )


@app.exception_handler(ValidationError)
async def handle_pydantic_validation_error(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "Validation failed",
            "details": _format_validation_errors(exc.errors()),
        },
    )


# 2. HTTP Exceptions -> preserve status code and standard {"error": ...} envelope
@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict):
        content = (
            exc.detail
            if "error" in exc.detail
            else {"error": exc.detail.get("message", str(exc.detail))}
        )
    else:
        content = {"error": exc.detail}
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=exc.headers,
    )


# 3. Unique Constraint Violations (SQLSTATE 23505) -> 409 Conflict
@app.exception_handler(asyncpg.UniqueViolationError)
async def handle_unique_violation(request: Request, exc: asyncpg.UniqueViolationError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": "That record already exists"},
    )


# 4. Database Connection Errors -> 503 Service Unavailable
CONNECTION_EXCEPTIONS = (
    asyncpg.PostgresConnectionError,
    asyncpg.CannotConnectNowError,
    asyncpg.AdminShutdownError,
    asyncpg.CrashShutdownError,
    asyncpg.InvalidAuthorizationSpecificationError,
    asyncpg.InterfaceError,
    ConnectionRefusedError,
    ConnectionResetError,
    ConnectionError,
    OSError,
)

async def _db_connection_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": "Database is unavailable. Start PostgreSQL and try again."},
    )


for exc_cls in CONNECTION_EXCEPTIONS:
    app.add_exception_handler(exc_cls, _db_connection_error_handler)


@app.exception_handler(Exception)
async def handle_generic_exception(request: Request, exc: Exception):
    err_code = getattr(exc, "code", None) or getattr(exc, "sqlstate", None)
    err_msg = str(exc)

    if err_code == "23505" or "unique constraint" in err_msg.lower():
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"error": "That record already exists"},
        )

    if (
        err_code in ["ECONNREFUSED", "57P01", "28000"]
        or isinstance(exc, CONNECTION_EXCEPTIONS)
        or any(
            phrase in err_msg.lower()
            for phrase in [
                "connection refused",
                "cannot connect",
                "database is unavailable",
                "pool is not connected",
            ]
        )
    ):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "Database is unavailable. Start PostgreSQL and try again."},
        )

    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": err_msg or "Internal server error"},
    )


# -------------------------------------------------------------
# CORS CONFIGURATION
# -------------------------------------------------------------
if settings.allow_all_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(destinations.router)
app.include_router(reviews.router)
app.include_router(trips.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(notifications.router)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=False,
    )
