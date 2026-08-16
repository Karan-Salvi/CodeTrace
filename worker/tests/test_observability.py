import logging
import uuid

import pytest

from src.db import get_engine
from src.observability import get_logger, write_indexing_usage_log


def test_logger_includes_job_and_repository_id(caplog: pytest.LogCaptureFixture) -> None:
    logger = get_logger(job_id="job-123", repository_id="repo-456")
    logger.logger.propagate = True
    with caplog.at_level(logging.INFO):
        logger.info("test message")

    assert len(caplog.records) >= 1
    record = caplog.records[-1]
    assert getattr(record, "job_id", None) == "job-123"
    assert getattr(record, "repository_id", None) == "repo-456"

@pytest.mark.asyncio
async def test_write_indexing_usage_log_inserts_a_row() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    from sqlalchemy import text

    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT id FROM repositories LIMIT 1"))
        row = result.first()
        if row is None:
            pytest.skip("no repository row available to attach usage_logs to")
        repository_id = row[0]

    job_id = f"job-test-{uuid.uuid4()}"
    await write_indexing_usage_log(
        engine,
        repository_id=repository_id,
        job_id=job_id,
        duration_ms=5000,
        files_processed=10,
        chunks_created=25,
        embeddings_generated=20,
        cache_hit_rate=0.2,
        cost_usd=0.0015,
    )

    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT kind, job_id, chunks_retrieved, total_latency_ms, cost_usd, cache_hit "
                "FROM usage_logs WHERE job_id = :job_id"
            ),
            {"job_id": job_id},
        )
        row = result.first()
        assert row is not None
        assert row[0] == "INDEXING"
        # Regression: chunks_created was accepted by this function but
        # never made it into the INSERT column list — silently dropped,
        # breaking observability.md's indexing metrics contract.
        assert row[2] == 25
        assert row[3] == 5000
        assert float(row[4]) == pytest.approx(0.0015)
        assert row[5] is True

    await engine.dispose()
