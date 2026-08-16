import asyncio
import logging
import signal
from types import FrameType

from src.config import get_settings
from src.queue_consumer import start_worker

logging.basicConfig(level=logging.INFO)


async def run() -> None:
    settings = get_settings()  # fails fast on missing/invalid env, matches backend's loadEnv() pattern
    worker = start_worker()
    logging.getLogger("worker").info(f"CodeTrace worker started, consuming index-job queue at {settings.redis_url}")

    # Python's default SIGTERM handler terminates the process immediately
    # (unlike SIGINT, which raises KeyboardInterrupt) — with no handler
    # registered here, `docker stop` / a container restart during
    # deployment would kill the process mid-job, abandoning an in-flight
    # index run mid-transaction rather than letting BullMQ finish or
    # cleanly fail it. Matches the graceful-shutdown pattern from
    # BullMQ's own Python Worker documentation.
    shutdown_event = asyncio.Event()

    def _signal_handler(_signum: int, _frame: FrameType | None) -> None:
        logging.getLogger("worker").info("Shutdown signal received, draining in-flight jobs...")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    try:
        await shutdown_event.wait()
    finally:
        await worker.close()
        logging.getLogger("worker").info("Worker shut down.")


if __name__ == "__main__":
    asyncio.run(run())
