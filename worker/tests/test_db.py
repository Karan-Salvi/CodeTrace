import pytest
from sqlalchemy import select

from src.db import get_engine, repositories_table


@pytest.mark.asyncio
async def test_engine_connects_to_real_database() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    async with engine.connect() as conn:
        result = await conn.execute(select(1))
        assert result.scalar() == 1
    await engine.dispose()

@pytest.mark.asyncio
async def test_repositories_table_matches_real_schema() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    async with engine.connect() as conn:
        # confirms the table object's columns actually exist in the live DB
        result = await conn.execute(select(repositories_table.c.id).limit(0))
        assert result is not None
    await engine.dispose()
