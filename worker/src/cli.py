import argparse
import asyncio
import logging
import uuid

from src.db import get_engine
from src.indexing.full_index import run_full_index
from src.observability import mark_repository_failed


async def run_index_command(repository_id: str) -> None:
    job_id = f"cli-{uuid.uuid4()}"
    try:
        await run_full_index(repository_id, job_id)
    except Exception as exc:
        # Same failure-handling contract as the queue path
        # (queue_consumer.py): never leave the repository stuck at an
        # intermediate status with no error recorded, even when triggered
        # from the standalone CLI instead of a real BullMQ job.
        try:
            await mark_repository_failed(get_engine(), repository_id, "FULL", str(exc))
        except Exception:
            # The FAILED-status write itself failing (e.g. repository_id
            # doesn't exist, DB pool exhausted) must not swallow the real
            # pipeline error and surface a confusing unrelated exception
            # instead — same reasoning as queue_consumer.py.
            logging.getLogger("worker").exception("failed to mark repository FAILED after job error")
        raise


def main() -> None:
    parser = argparse.ArgumentParser(prog="worker.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    index_parser = subparsers.add_parser("index", help="Run a full index for a repository")
    index_parser.add_argument("repository_id", help="UUID of an existing repositories row")

    args = parser.parse_args()

    if args.command == "index":
        asyncio.run(run_index_command(args.repository_id))


if __name__ == "__main__":
    main()
