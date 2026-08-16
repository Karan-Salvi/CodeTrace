from functools import lru_cache

from sqlalchemy import Column, Integer, MetaData, Numeric, String, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from src.config import get_settings

metadata = MetaData()

# The only Table object in this module — every actual query elsewhere in
# the worker uses raw text() SQL. This one exists solely so
# test_repositories_table_matches_real_schema can catch drift against the
# live DB; it was previously joined by 6 sibling Table defs (files,
# chunks, symbol_relationships, commits, index_jobs, usage_logs) that were
# never imported by any query and never schema-checked — dead code that
# looked like verified documentation but wasn't (usage_logs_table had
# silently drifted, missing several real columns). Deleted rather than
# wired up: add back only alongside its own schema-match test.
repositories_table = Table(
    "repositories",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("status", String, nullable=False),
    Column("files_indexed", Integer, nullable=False),
    Column("chunks_indexed", Integer, nullable=False),
    Column("current_commit_sha", String, nullable=True),
    Column("embedding_cost_usd", Numeric(10, 4), nullable=False),
)


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    # asyncpg needs the postgresql+asyncpg:// scheme, not the bare
    # postgresql:// the rest of the stack (Prisma) uses
    url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    # This engine is cached (lru_cache) and reused for the worker process's
    # entire lifetime — potentially days, consuming the same long-lived
    # BullMQ queue (main.py). Without pool_pre_ping, a connection left idle
    # across a Postgres restart/failover/network blip goes stale in the
    # pool and the next job's query fails with a raw asyncpg connection
    # error instead of transparently reconnecting.
    return create_async_engine(url, echo=False, pool_pre_ping=True)
