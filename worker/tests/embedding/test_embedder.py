import os

import pytest

from src.embedding.embedder import embed_batch, embed_text

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
