import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from src.db import get_engine
from src.embedding.batcher import embed_and_store_batch


@pytest.mark.asyncio
async def test_dedupes_identical_content_within_the_same_batch() -> None:
    # indexing.md: two chunks with identical content must not each trigger
    # their own embedding call — dedup by content_hash within the batch,
    # not only against the DB cache.
    get_engine.cache_clear()
    engine = get_engine()
    model_version = f"test-model-{uuid.uuid4()}"
    same_hash = f"hash-{uuid.uuid4()}"

    with patch(
        "src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536]
    ) as mock_embed:
        result = await embed_and_store_batch(
            engine, [(same_hash, "content a"), (same_hash, "content a")], model_version
        )

    mock_embed.assert_awaited_once_with(["content a"])
    assert result == {same_hash: False}
    await engine.dispose()


@pytest.mark.asyncio
async def test_skips_embedding_for_already_cached_content_hash() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    model_version = f"test-model-{uuid.uuid4()}"
    cached_hash = f"hash-{uuid.uuid4()}"

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO embeddings (content_hash, model_version, vector, created_at) "
                "VALUES (:hash, :model_version, CAST(:vector AS vector), now())"
            ),
            {"hash": cached_hash, "model_version": model_version, "vector": f"[{','.join(['0.1'] * 1536)}]"},
        )

    with patch(
        "src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[]
    ) as mock_embed:
        result = await embed_and_store_batch(engine, [(cached_hash, "content a")], model_version)

    mock_embed.assert_not_awaited()
    assert result == {cached_hash: True}
    await engine.dispose()


@pytest.mark.asyncio
async def test_raises_on_provider_returning_fewer_vectors_than_requested() -> None:
    # architecture.md: on embedding provider failure mid-batch, the batch
    # fails as a unit — a count mismatch must raise, not silently
    # mis-pair vectors with the wrong content_hash or drop chunks.
    get_engine.cache_clear()
    engine = get_engine()
    model_version = f"test-model-{uuid.uuid4()}"
    hash_a, hash_b = f"hash-{uuid.uuid4()}", f"hash-{uuid.uuid4()}"

    with (
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536]),
        pytest.raises(RuntimeError, match="size mismatch"),
    ):
        await embed_and_store_batch(
            engine, [(hash_a, "content a"), (hash_b, "content b")], model_version
        )
    await engine.dispose()


@pytest.mark.asyncio
async def test_returns_empty_dict_for_empty_input() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    with patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock) as mock_embed:
        result = await embed_and_store_batch(engine, [], "any-model")
    mock_embed.assert_not_awaited()
    assert result == {}
    await engine.dispose()
