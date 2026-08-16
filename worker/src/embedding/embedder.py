from google import genai
from google.genai import types

from src.config import get_settings

_EMBED_DIMENSIONALITY = 1536


def _client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


async def embed_text(text: str) -> list[float]:
    client = _client()
    result = await client.aio.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=_EMBED_DIMENSIONALITY),
    )
    if not result.embeddings or result.embeddings[0].values is None:
        return []
    return list(result.embeddings[0].values)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    client = _client()
    result = await client.aio.models.embed_content(
        model="gemini-embedding-001",
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=_EMBED_DIMENSIONALITY),
    )
    if not result.embeddings:
        return []
    # A per-item `values is None` (provider returned an embedding entry with
    # no vector) used to silently become `[]` here, which passed batcher.py's
    # length check (item count still matched) but then hit `embeddings.vector`
    # — a fixed vector(1536) NOT NULL column — with a 0-dim literal, failing
    # with an opaque Postgres cast error far from the real cause. Raise here
    # instead, at the source, with the actual provider-failure reason.
    missing = [i for i, e in enumerate(result.embeddings) if e.values is None]
    if missing:
        raise RuntimeError(
            f"Gemini embed_content returned {len(missing)} embedding(s) with no vector "
            f"(indices {missing} of {len(result.embeddings)}) for this batch."
        )
    return [list(e.values) for e in result.embeddings]  # type: ignore[arg-type]
