from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import db
from app.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager to initialize and cleanup resources."""
    # Startup: attempt database connection
    await db.connect()
    yield
    # Shutdown: close database connections
    await db.disconnect()


app = FastAPI(
    title="Porikroma API",
    description="FastAPI backend for Porikroma travel planning platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS - allow all origins with credentials, identical to legacy Fastify backend
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

# Include Routers
app.include_router(health.router)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=False,
    )
