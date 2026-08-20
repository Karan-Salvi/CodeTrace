import asyncio

from google.genai import errors as genai_errors
from sqlalchemy.ext.asyncio import AsyncEngine

from src.embedding.cache import get_cached_content_hashes, upsert_embedding
from src.embedding.embedder import embed_batch

# Gemini's batchEmbedContents caps a single request at 100 items
# ("at most 100 requests can be in one batch"). A repo with more than 100
# uncached chunks used to blow this in one shot and fail the whole
# indexing job — split into sub-batches here so batch size is never a
# function of repo size. Kept well under the 100 hard cap because the
# free-tier embedding quota is a requests/tokens-per-minute limit, not
# just a per-call item cap — a single 100-chunk call of real code (each
# chunk up to max_file_size_bytes) can burn a whole minute's quota in one
# request and 429 immediately, as seen indexing a 104-file repo.
_MAX_EMBED_REQUESTS_PER_CALL = 20
_MAX_RETRIES_PER_SUB_BATCH = 5
_RETRY_BASE_DELAY_SECONDS = 5.0


async def _embed_with_retry(texts: list[str]) -> list[list[float]]:
    for attempt in range(_MAX_RETRIES_PER_SUB_BATCH):
        try:
            return await embed_batch(texts)
        except genai_errors.APIError as e:
            if e.code != 429 or attempt == _MAX_RETRIES_PER_SUB_BATCH - 1:
                raise
            # Free-tier embedding quota is per-minute — a fixed 429 needs
            # real wall-clock delay before retrying, not the job-level
            # BullMQ backoff (2s/4s/8s), which is far too fast to let a
            # per-minute quota window roll over.
            await asyncio.sleep(_RETRY_BASE_DELAY_SECONDS * (2**attempt))
    raise AssertionError("unreachable")


async def _embed_batch_chunked(texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for i in range(0, len(texts), _MAX_EMBED_REQUESTS_PER_CALL):
        vectors.extend(await _embed_with_retry(texts[i : i + _MAX_EMBED_REQUESTS_PER_CALL]))
    return vectors


async def embed_and_store_batch(
    engine: AsyncEngine, chunks: list[tuple[str, str]], model_version: str
) -> dict[str, bool]:
    """chunks: list of (content_hash, content). Returns content_hash -> cache_hit."""
    content_hashes = [h for h, _ in chunks]
    cached = await get_cached_content_hashes(engine, content_hashes, model_version)

    result: dict[str, bool] = {}
    # indexing.md: content-hash caching is the project's core performance
    # story — two chunks with identical content (common: repeated
    # boilerplate, duplicate error handlers) must not each trigger their
    # own embedding call. Dedup by content_hash within this batch too,
    # not only against what's already in the DB cache, or we'd pay for
    # (and needlessly re-send) the same embedding request twice in a row.
    to_embed_by_hash: dict[str, str] = {}

    for content_hash, content in chunks:
        if content_hash in cached:
            result[content_hash] = True
        else:
            to_embed_by_hash[content_hash] = content

    to_embed = list(to_embed_by_hash.items())

    if to_embed:
        # architecture.md: on embedding provider failure mid-batch, the
        # batch fails as a unit — no partial commit of some chunks while
        # silently skipping others. embed_batch returning fewer/more
        # vectors than requested texts (a malformed response, or [] on a
        # whole-batch provider failure per embedder.py) must raise here,
        # not silently zip-truncate — a mismatched count would either
        # pair the wrong vector with the wrong content_hash, or (in the
        # empty-list case) skip every chunk in the batch with no error
        # at all, leaving the caller believing the batch succeeded.
        vectors = await _embed_batch_chunked([content for _, content in to_embed])
        if len(vectors) != len(to_embed):
            raise RuntimeError(
                f"Embedding batch size mismatch: requested {len(to_embed)} embeddings, "
                f"provider returned {len(vectors)}. Failing the batch as a unit rather "
                f"than silently mis-pairing or dropping chunks."
            )

        for (content_hash, _), vector in zip(to_embed, vectors):
            await upsert_embedding(engine, content_hash, model_version, vector)
            result[content_hash] = False

    return result
