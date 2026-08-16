import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from src.db import get_engine
from src.queue_consumer import _resolve_attempt_state, process_job


async def _seed_repository(engine: AsyncEngine) -> str:
    repository_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    installation_id = str(uuid.uuid4())

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO users (id, github_id, username, github_access_token, created_at, updated_at) "
                "VALUES (:id, :github_id, 'testuser', 'enc', now(), now())"
            ),
            {"id": user_id, "github_id": hash(repository_id) % 1_000_000_000},
        )
        await conn.execute(
            text(
                "INSERT INTO repository_installations (id, github_installation_id, user_id, permissions, created_at) "
                "VALUES (:id, :gh_install_id, :user_id, '{}', now())"
            ),
            {"id": installation_id, "gh_install_id": hash(installation_id) % 1_000_000_000, "user_id": user_id},
        )
        await conn.execute(
            text(
                "INSERT INTO repositories "
                "(id, user_id, installation_id, owner, name, github_url, default_branch, status, "
                "files_indexed, chunks_indexed, embedding_cost_usd, created_at, updated_at) "
                "VALUES (:id, :user_id, :installation_id, 'test', 'repo', 'unused', 'main', 'EMBEDDING', 0, 0, 0, now(), now())"
            ),
            {"id": repository_id, "user_id": user_id, "installation_id": installation_id},
        )
    return repository_id


@pytest.mark.asyncio
async def test_full_type_job_calls_run_full_index() -> None:
    with patch("src.queue_consumer.run_full_index", new_callable=AsyncMock) as mock_full, \
         patch("src.queue_consumer.run_incremental_index", new_callable=AsyncMock) as mock_incremental:
        await process_job({"jobId": "job-1", "repositoryId": "repo-1", "type": "FULL"})

    mock_full.assert_called_once_with("repo-1", "job-1")
    mock_incremental.assert_not_called()

@pytest.mark.asyncio
async def test_incremental_type_job_calls_run_incremental_index() -> None:
    with patch("src.queue_consumer.run_full_index", new_callable=AsyncMock) as mock_full, \
         patch("src.queue_consumer.run_incremental_index", new_callable=AsyncMock) as mock_incremental:
        await process_job({"jobId": "job-2", "repositoryId": "repo-2", "type": "INCREMENTAL"})

    mock_incremental.assert_called_once_with("repo-2", "job-2")
    mock_full.assert_not_called()

@pytest.mark.asyncio
async def test_unknown_type_raises() -> None:
    with pytest.raises(ValueError):
        await process_job({"jobId": "job-3", "repositoryId": "repo-3", "type": "BOGUS"})


@pytest.mark.asyncio
async def test_pipeline_failure_marks_repository_failed_and_reraises() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)

    with (
        patch(
            "src.queue_consumer.run_full_index",
            new_callable=AsyncMock,
            side_effect=RuntimeError("clone failed"),
        ),
        pytest.raises(RuntimeError, match="clone failed"),
    ):
        await process_job({"jobId": "job-fail-1", "repositoryId": repository_id, "type": "FULL"})

    async with engine.connect() as conn:
        repo_row = (await conn.execute(
            text("SELECT status FROM repositories WHERE id = :id"), {"id": repository_id}
        )).first()
        job_row = (await conn.execute(
            text("SELECT status, error_message FROM index_jobs WHERE repository_id = :id"),
            {"id": repository_id},
        )).first()

    assert repo_row is not None
    assert repo_row[0] == "FAILED"
    assert job_row is not None
    assert job_row[0] == "FAILED"
    assert "clone failed" in job_row[1]
    await engine.dispose()


@pytest.mark.asyncio
async def test_final_attempt_records_the_real_attempt_number() -> None:
    # attempt_count previously was hardcoded to 1 in mark_repository_failed
    # regardless of how many BullMQ attempts actually ran — this pins it to
    # the value process_job threads through from attempts_made + 1.
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)

    with (
        patch(
            "src.queue_consumer.run_full_index",
            new_callable=AsyncMock,
            side_effect=RuntimeError("failed on last try"),
        ),
        pytest.raises(RuntimeError, match="failed on last try"),
    ):
        await process_job(
            {"jobId": "job-fail-3", "repositoryId": repository_id, "type": "FULL"},
            is_final_attempt=True,
            attempt_number=3,
        )

    async with engine.connect() as conn:
        job_row = (await conn.execute(
            text("SELECT attempt_count FROM index_jobs WHERE repository_id = :id"),
            {"id": repository_id},
        )).first()

    assert job_row is not None
    assert job_row[0] == 3
    await engine.dispose()


class _FakeJob:
    def __init__(self, attempts_made: int, attempts: int, opts: dict[str, object] | None = None) -> None:
        self.attemptsMade = attempts_made
        self.attempts = attempts
        if opts is not None:
            self.opts = opts


def test_resolve_attempt_state_not_final_when_retries_remain() -> None:
    # attempt 1 of 3: attemptsMade is still 0 (only incremented after a
    # completed failed attempt), so this must NOT be treated as final.
    is_final, attempt_number = _resolve_attempt_state(_FakeJob(attempts_made=0, attempts=3))
    assert is_final is False
    assert attempt_number == 1


def test_resolve_attempt_state_final_on_last_attempt() -> None:
    # attempt 3 of 3: attemptsMade is 2 (two prior failed attempts done).
    is_final, attempt_number = _resolve_attempt_state(_FakeJob(attempts_made=2, attempts=3))
    assert is_final is True
    assert attempt_number == 3


def test_resolve_attempt_state_ignores_stray_zero_in_opts() -> None:
    # Regression: bullmq's Job.__init__ pre-seeds job.opts with
    # {"attempts": 0, ...} before merging real opts. Reading
    # job.opts.get("attempts", 1) instead of job.attempts made this resolve
    # to max_attempts=0, marking every job FAILED on its very first
    # attempt regardless of the real retry budget. job.attempts (set
    # separately by bullmq with the correct default) must be what's used.
    job = _FakeJob(attempts_made=0, attempts=3, opts={"attempts": 0})
    is_final, attempt_number = _resolve_attempt_state(job)
    assert is_final is False
    assert attempt_number == 1


@pytest.mark.asyncio
async def test_non_final_attempt_failure_does_not_mark_repository_failed() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)

    with (
        patch(
            "src.queue_consumer.run_full_index",
            new_callable=AsyncMock,
            side_effect=RuntimeError("transient network blip"),
        ),
        pytest.raises(RuntimeError, match="transient network blip"),
    ):
        # attempt 1 of 3 (BullMQ still has retries left) — repository must
        # stay in its current status, not flip to FAILED, since a retry is
        # about to run and the frontend's progress subscription treats
        # FAILED as terminal.
        await process_job(
            {"jobId": "job-fail-2", "repositoryId": repository_id, "type": "FULL"},
            is_final_attempt=False,
        )

    async with engine.connect() as conn:
        repo_row = (await conn.execute(
            text("SELECT status FROM repositories WHERE id = :id"), {"id": repository_id}
        )).first()
        job_row = (await conn.execute(
            text("SELECT id FROM index_jobs WHERE repository_id = :id"), {"id": repository_id}
        )).first()

    assert repo_row is not None
    assert repo_row[0] == "EMBEDDING"  # unchanged from the seeded fixture status
    assert job_row is None  # no FAILED index_jobs row written for a retryable attempt
    await engine.dispose()
