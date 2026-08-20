import uuid
from unittest.mock import AsyncMock, patch

import pytest
from google.genai import errors as genai_errors
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
async def test_splits_into_sub_batches_for_gemini_request_cap() -> None:
    # Gemini's batchEmbedContents caps a request at 100 items, and the
    # free-tier per-minute quota makes even a 100-item call of real code
    # risky — a repo with more uncached chunks than one sub-batch must
    # not be sent as one call.
    get_engine.cache_clear()
    engine = get_engine()
    model_version = f"test-model-{uuid.uuid4()}"
    chunks = [(f"hash-{i}", f"content {i}") for i in range(45)]

    async def fake_embed_batch(texts: list[str]) -> list[list[float]]:
        return [[0.1] * 1536 for _ in texts]

    with patch(
        "src.embedding.batcher.embed_batch", new_callable=AsyncMock, side_effect=fake_embed_batch
    ) as mock_embed:
        result = await embed_and_store_batch(engine, chunks, model_version)

    assert mock_embed.await_count == 3
    assert [len(call.args[0]) for call in mock_embed.await_args_list] == [20, 20, 5]
    assert len(result) == 45


@pytest.mark.asyncio
async def test_retries_sub_batch_on_429_then_succeeds() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    model_version = f"test-model-{uuid.uuid4()}"
    chunks = [(f"hash-{i}", f"content {i}") for i in range(3)]

    rate_limit_error = genai_errors.APIError(
        429, {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "quota"}}
    )
    calls = {"n": 0}

    async def flaky_embed_batch(texts: list[str]) -> list[list[float]]:
        calls["n"] += 1
        if calls["n"] == 1:
            raise rate_limit_error
        return [[0.1] * 1536 for _ in texts]

    with (
        patch("asyncio.sleep", new_callable=AsyncMock),
        patch(
            "src.embedding.batcher.embed_batch", new_callable=AsyncMock, side_effect=flaky_embed_batch
        ) as mock_embed,
    ):
        result = await embed_and_store_batch(engine, chunks, model_version)

    assert mock_embed.await_count == 2
    assert len(result) == 3
    await engine.dispose()


@pytest.mark.asyncio
async def test_raises_immediately_on_non_429_api_error() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    model_version = f"test-model-{uuid.uuid4()}"
    chunks = [(f"hash-{i}", f"content {i}") for i in range(3)]

    server_error = genai_errors.APIError(
        500, {"error": {"code": 500, "status": "INTERNAL", "message": "boom"}}
    )

    with (
        patch(
            "src.embedding.batcher.embed_batch", new_callable=AsyncMock, side_effect=server_error
        ) as mock_embed,
        pytest.raises(genai_errors.APIError),
    ):
        await embed_and_store_batch(engine, chunks, model_version)

    assert mock_embed.await_count == 1
    await engine.dispose()
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
