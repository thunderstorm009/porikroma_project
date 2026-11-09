import asyncio
import logging
from typing import Any, AsyncGenerator, List, Optional
import asyncpg
from app.config import settings

logger = logging.getLogger("uvicorn.error")


class Database:
    """PostgreSQL database manager using asyncpg connection pool."""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._is_connected: bool = False

    async def connect(self) -> bool:
        """Initialize the asyncpg connection pool."""
        try:
            self.pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                command_timeout=10.0,
                timeout=5.0,
            )
            # Test immediate query
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            self._is_connected = True
            logger.info("Database connection pool established successfully.")
            return True
        except Exception as exc:
            self._is_connected = False
            logger.warning(
                "Database initialization warning: unable to connect to %s (%s). The server will start, but database operations may fail until PostgreSQL is available.",
                settings.DATABASE_URL,
                exc,
            )
            return False

    async def disconnect(self) -> None:
        """Close the asyncpg connection pool."""
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
            self._is_connected = False
            logger.info("Database connection pool closed.")

    async def check_connection(self) -> bool:
        """Check if the database connection is alive and healthy."""
        if self.pool is None:
            try:
                # Attempt lazy reconnect if pool was not established
                reconnected = await asyncio.wait_for(self.connect(), timeout=2.0)
                return reconnected
            except Exception:
                return False

        try:
            async with self.pool.acquire() as conn:
                val = await asyncio.wait_for(conn.fetchval("SELECT 1"), timeout=2.0)
                self._is_connected = (val == 1)
                return self._is_connected
        except Exception as exc:
            logger.debug("Database ping check failed: %s", exc)
            self._is_connected = False
            return False

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    async def fetch(self, query: str, *args: Any) -> List[asyncpg.Record]:
        """Fetch multiple rows."""
        if not self.pool:
            raise RuntimeError("Database pool is not connected.")
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> Optional[asyncpg.Record]:
        """Fetch a single row."""
        if not self.pool:
            raise RuntimeError("Database pool is not connected.")
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args: Any) -> Any:
        """Fetch a single value."""
        if not self.pool:
            raise RuntimeError("Database pool is not connected.")
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args: Any) -> str:
        """Execute a query."""
        if not self.pool:
            raise RuntimeError("Database pool is not connected.")
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)


db = Database()


async def get_db() -> AsyncGenerator[Database, None]:
    """Dependency for providing database instance."""
    yield db
