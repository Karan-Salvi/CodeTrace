import hashlib

import pytest

from src.db import get_engine
from src.embedding.cache import get_cached_content_hashes, upsert_embedding


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()

@pytest.mark.asyncio
async def test_upsert_then_cache_hit() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    content_hash = _hash("unique test content for cache")
    model_version = "gemini-embedding-001-1536"
    vector = [0.1] * 1536

    async with engine.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("DELETE FROM embeddings WHERE content_hash = :h"),
            {"h": content_hash},
        )

    await upsert_embedding(engine, content_hash, model_version, vector)

    cached = await get_cached_content_hashes(engine, [content_hash], model_version)
    assert content_hash in cached
    await engine.dispose()

@pytest.mark.asyncio
async def test_upsert_is_idempotent_on_conflict() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    content_hash = _hash("idempotent test content")
    model_version = "gemini-embedding-001-1536"

    await upsert_embedding(engine, content_hash, model_version, [0.1] * 1536)
    # second upsert of the same key must not raise
    await upsert_embedding(engine, content_hash, model_version, [0.2] * 1536)

    cached = await get_cached_content_hashes(engine, [content_hash], model_version)
    assert content_hash in cached
    await engine.dispose()

@pytest.mark.asyncio
async def test_uncached_hash_not_returned() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    cached = await get_cached_content_hashes(engine, ["nonexistent-hash-xyz"], "gemini-embedding-001-1536")
    assert "nonexistent-hash-xyz" not in cached
    await engine.dispose()
