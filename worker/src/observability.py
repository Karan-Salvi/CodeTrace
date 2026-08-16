import json
import logging
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "message": record.getMessage(),
            "level": record.levelname,
            "job_id": getattr(record, "job_id", None),
            "repository_id": getattr(record, "repository_id", None),
        }
        return json.dumps(payload)


_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())


def get_logger(job_id: str, repository_id: str) -> logging.LoggerAdapter[logging.Logger]:
    base_logger = logging.getLogger("worker")
    base_logger.setLevel(logging.INFO)
    if not base_logger.handlers:
        base_logger.addHandler(_handler)
        base_logger.propagate = False

    return logging.LoggerAdapter(base_logger, {"job_id": job_id, "repository_id": repository_id})


async def mark_repository_failed(
    engine: AsyncEngine, repository_id: str, job_type: str, error_message: str, attempt_count: int = 1
) -> None:
    # indexing.md: every stage can fail independently; on failure the
    # repository is marked FAILED with the error recorded — never left
    # silently stuck at whatever intermediate status it was last in.
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE repositories SET status = 'FAILED' WHERE id = :id"),
            {"id": repository_id},
        )
        await conn.execute(
            text(
                "INSERT INTO index_jobs "
                "(id, repository_id, type, status, attempt_count, error_message, created_at) "
                "VALUES (:id, :rid, CAST(:job_type AS \"IndexJobType\"), 'FAILED', :attempt_count, :error, now())"
            ),
            {
                "id": str(uuid.uuid4()), "rid": repository_id,
                "job_type": job_type, "attempt_count": attempt_count, "error": error_message[:2000],
            },
        )


async def write_indexing_usage_log(
    engine: AsyncEngine,
    repository_id: str,
    job_id: str,
    duration_ms: int,
    files_processed: int,
    chunks_created: int,
    embeddings_generated: int,
    cache_hit_rate: float,
    cost_usd: float,
) -> None:
    # ponytail: files_processed and embeddings_generated have no usage_logs
    # column (schema only has chunks_retrieved, reused here for
    # chunks_created) — backend owns the migration, worker can't add one.
    # observability.md documents both as part of the indexing metrics
    # contract; add the columns and wire these two through when needed.
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO usage_logs "
                "(id, repository_id, request_id, job_id, kind, total_latency_ms, cost_usd, "
                "chunks_retrieved, cache_hit, created_at) "
                "VALUES (:id, :repository_id, :request_id, :job_id, 'INDEXING', :duration_ms, :cost_usd, "
                ":chunks_created, :cache_hit, now())"
            ),
            {
                "id": str(uuid.uuid4()),
                "repository_id": repository_id,
                "request_id": job_id,
                "job_id": job_id,
                "duration_ms": duration_ms,
                "cost_usd": cost_usd,
                "chunks_created": chunks_created,
                "cache_hit": cache_hit_rate > 0,
            },
        )
