import os
from unittest.mock import patch

import pytest

import src.embedding.embedder as embedder_module
from src.embedding.embedder import embed_batch, embed_text


def test_next_key_round_robins_across_configured_pool() -> None:
    # Reset module-level cycle state so this test doesn't depend on
    # whatever order other tests ran in.
    embedder_module._key_cycle = None
    embedder_module._key_cycle_pool = None

    class FakeSettings:
        gemini_api_key_pool = ["key-a", "key-b", "key-c"]

    with patch("src.embedding.embedder.get_settings", return_value=FakeSettings()):
        keys = [embedder_module._next_key() for _ in range(7)]

    assert keys == ["key-a", "key-b", "key-c", "key-a", "key-b", "key-c", "key-a"]

requires_gemini_key = pytest.mark.skipif(
    not os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") == "dummy_gemini_key",
    reason="requires a real GEMINI_API_KEY",
)

@requires_gemini_key
@pytest.mark.asyncio
async def test_embed_text_returns_1536_dim_vector() -> None:
    vector = await embed_text("what does handleAuthError do")
    assert len(vector) == 1536

@requires_gemini_key
@pytest.mark.asyncio
async def test_embed_batch_returns_one_vector_per_input() -> None:
    vectors = await embed_batch(["function one", "function two", "function three"])
    assert len(vectors) == 3
    assert all(len(v) == 1536 for v in vectors)
