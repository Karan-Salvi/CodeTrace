from typing import Any

from bullmq import Worker

from src.config import get_settings
from src.db import get_engine
from src.indexing.full_index import run_full_index
from src.indexing.incremental_index import run_incremental_index
from src.observability import get_logger, mark_repository_failed

INDEX_JOB_QUEUE = "index-job"


async def process_job(job_data: dict[str, Any], is_final_attempt: bool = True, attempt_number: int = 1) -> None:
    job_type = job_data.get("type")
    repository_id = job_data["repositoryId"]
    job_id = job_data["jobId"]

    if job_type not in ("FULL", "INCREMENTAL"):
        raise ValueError(f"Unknown index job type: {job_type}")

    try:
        if job_type == "FULL":
            await run_full_index(repository_id, job_id)
        else:
            await run_incremental_index(repository_id, job_id)
    except Exception as exc:
        logger = get_logger(job_id=job_id, repository_id=repository_id)
        logger.error(f"indexing job failed: {exc}")

        # indexing.md: a crashed/failed job must leave the repository in a
        # clearly-failed state — but only once retries are exhausted.
        # BullMQ (attempts: 3, configured in the backend producer) will
        # retry this job automatically; marking FAILED on attempt 1 of 3
        # would make the frontend's progress subscription
        # (index-progress.handler.ts) see FAILED as terminal and stop
        # listening, even though the job goes on to succeed on attempt 2.
        if is_final_attempt:
            try:
                await mark_repository_failed(
                    get_engine(), repository_id, job_type, str(exc), attempt_count=attempt_number
                )
            except Exception as mark_failed_exc:  # noqa: BLE001
                # The FAILED-status write itself failing (e.g. DB pool
                # exhausted) must not swallow the real pipeline error —
                # the original exc is already logged above and is what
                # gets re-raised to BullMQ; this is a secondary problem
                # to know about, not the one that should win.
                logger.error(f"failed to mark repository FAILED after job error: {mark_failed_exc}")
        raise


def _resolve_attempt_state(job: Any) -> tuple[bool, int]:
    # BullMQ only increments job.attemptsMade AFTER a failed attempt
    # completes (in moveToFailed) — while the processor is running,
    # attemptsMade still reflects only *previously* completed attempts,
    # not the one in progress. BullMQ's own shouldRetryJob check is
    # `attemptsMade + 1 < opts.attempts`, so the mirror check for "this
    # is the last allowed attempt" is `attemptsMade + 1 >= attempts`.
    attempts_made = getattr(job, "attemptsMade", 0)
    # job.attempts (not job.opts["attempts"]) — bullmq's Job.__init__
    # seeds opts with {"attempts": 0, ...} before merging in the caller's
    # real opts, so `job.opts.get("attempts", 1)` returns that stray 0
    # whenever attempts is absent, not our intended fallback of 1. That
    # makes is_final_attempt true on the very first failure, marking the
    # repository FAILED before BullMQ's own retry ever runs. job.attempts
    # is set directly from `opts.get("attempts", 1)` with the correct
    # default and has no such landmine.
    max_attempts = getattr(job, "attempts", 1)
    is_final_attempt = (attempts_made + 1) >= max_attempts
    return is_final_attempt, attempts_made + 1


def start_worker() -> Worker:
    settings = get_settings()

    async def _handler(job: Any, _job_token: str) -> None:
        is_final_attempt, attempt_number = _resolve_attempt_state(job)
        await process_job(job.data, is_final_attempt=is_final_attempt, attempt_number=attempt_number)

    return Worker(INDEX_JOB_QUEUE, _handler, {"connection": settings.redis_url})
