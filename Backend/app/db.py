import asyncio
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from typing import Any, AsyncGenerator, List, Optional
import asyncpg
from app.config import settings

logger = logging.getLogger("uvicorn.error")


class Database:
    """PostgreSQL database manager using an asyncpg connection pool."""

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

    async def init_schema(self, schema_path: Optional[str] = None) -> bool:
        """Apply schema.sql idempotently to create all tables and indexes if missing."""
        if not self.pool:
            return False

        if schema_path is None:
            target_path = Path(__file__).resolve().parent.parent / "schema.sql"
        else:
            target_path = Path(schema_path)

        if not target_path.exists():
            logger.warning("schema.sql not found at %s", target_path)
            return False

        try:
            sql = target_path.read_text(encoding="utf-8")
            async with self.pool.acquire() as conn:
                await conn.execute(sql)
                # Apply checked-in, idempotent migrations after the base schema so
                # fresh Docker installs and existing databases converge equally.
                migrations_dir = target_path.parent / "migrations"
                if migrations_dir.is_dir():
                    for migration_path in sorted(migrations_dir.glob("*.sql")):
                        await conn.execute(migration_path.read_text(encoding="utf-8"))
            logger.info("Database schema applied successfully from %s.", target_path.name)
            return True
        except Exception as exc:
            logger.error("Failed to apply schema.sql: %s", exc)
            raise

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

    def _ensure_pool(self) -> asyncpg.Pool:
        """Return active pool or raise InterfaceError if database is unavailable."""
        if not self.pool:
            raise asyncpg.InterfaceError(
                "Database is unavailable. Start PostgreSQL and try again."
            )
        return self.pool

    async def fetch(self, query: str, *args: Any) -> List[asyncpg.Record]:
        """Fetch multiple rows from the database."""
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> Optional[asyncpg.Record]:
        """Fetch a single row from the database."""
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args: Any) -> Any:
        """Fetch a single scalar value from the database."""
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args: Any) -> str:
        """Execute a query and return status string."""
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a single connection from the pool."""
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            yield conn

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a connection and execute within a transaction."""
        pool = self._ensure_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                yield conn


db = Database()


async def get_db() -> AsyncGenerator[Database, None]:
    """Dependency providing database instance."""
    yield db
