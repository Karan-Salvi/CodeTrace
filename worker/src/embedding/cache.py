from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def get_cached_content_hashes(
    engine: AsyncEngine, content_hashes: list[str], model_version: str
) -> set[str]:
    if not content_hashes:
        return set()

    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT content_hash FROM embeddings "
                "WHERE content_hash = ANY(:hashes) AND model_version = :model_version"
            ),
            {"hashes": content_hashes, "model_version": model_version},
        )
        return {row[0] for row in result}


async def upsert_embedding(
    engine: AsyncEngine, content_hash: str, model_version: str, vector: list[float]
) -> None:
    vector_literal = f"[{','.join(str(v) for v in vector)}]"
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO embeddings (content_hash, model_version, vector, created_at) "
                "VALUES (:content_hash, :model_version, CAST(:vector AS vector), now()) "
                "ON CONFLICT (content_hash, model_version) DO NOTHING"
            ),
            {"content_hash": content_hash, "model_version": model_version, "vector": vector_literal},
        )
