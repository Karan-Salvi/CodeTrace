import asyncio
import subprocess
from pathlib import Path

import pytest

from src.github.clone import clone_repository


def _make_local_bare_repo(tmp_path: Path) -> str:
    """Builds a tiny local git repo to clone from, avoiding a real network call."""
    src = tmp_path / "source"
    src.mkdir()
    subprocess.run(["git", "init"], cwd=src, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=src, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=src, check=True)
    (src / "README.md").write_text("hello")
    subprocess.run(["git", "add", "."], cwd=src, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=src, check=True, capture_output=True)
    return str(src)

@pytest.mark.asyncio
async def test_clone_returns_head_commit_sha(tmp_path: Path) -> None:
    source_path = _make_local_bare_repo(tmp_path)
    dest_dir = str(tmp_path / "cloned")

    sha = await clone_repository(f"file://{source_path}", token="unused-for-local-clone", dest_dir=dest_dir, timeout_seconds=30)

    assert len(sha) == 40
    import os
    assert os.path.exists(os.path.join(dest_dir, "README.md"))

@pytest.mark.asyncio
async def test_clone_failure_never_leaks_the_token(tmp_path: Path) -> None:
    # security.md: "No raw tokens or secrets in logs." A failed clone's
    # exception message (which propagates all the way to
    # queue_consumer.py's failure handler and is written to
    # index_jobs.error_message) must never contain the installation
    # token, even though it's embedded in the clone URL git actually runs.
    secret_token = "SUPER_SECRET_TOKEN_ABC123"
    dest_dir = str(tmp_path / "cloned-should-fail")

    with pytest.raises(RuntimeError) as exc_info:
        await clone_repository(
            "https://github.com/definitely-nonexistent-owner-xyz/definitely-nonexistent-repo-xyz",
            token=secret_token,
            dest_dir=dest_dir,
            timeout_seconds=30,
        )

    assert secret_token not in str(exc_info.value)


@pytest.mark.asyncio
async def test_clone_of_empty_repository_raises_runtime_error(tmp_path: Path) -> None:
    # Regression: `git rev-parse HEAD` after a successful clone had no
    # try/except at all — an empty GitHub repo (zero commits, a real
    # reachable state) makes it exit 128 with a raw, unhandled
    # CalledProcessError instead of the same RuntimeError pattern every
    # other failure in this function uses.
    src = tmp_path / "empty-source"
    src.mkdir()
    subprocess.run(["git", "init"], cwd=src, check=True, capture_output=True)  # noqa: ASYNC221
    dest_dir = str(tmp_path / "cloned-empty")

    with pytest.raises(RuntimeError, match="rev-parse HEAD"):
        await clone_repository(f"file://{src}", token="unused-for-local-clone", dest_dir=dest_dir, timeout_seconds=30)


@pytest.mark.asyncio
async def test_clone_does_not_block_the_event_loop(tmp_path: Path) -> None:
    # Regression: subprocess.run called directly inside an async function
    # blocks the whole event loop for the clone's duration. BullMQ's
    # Python Worker relies on the event loop staying free to renew its
    # job lock (docs: "make sure the workers return the control to the
    # event loop often enough") — a blocked loop risks the job being
    # marked stalled and double-processed by another worker. Proves the
    # fix by running a concurrent asyncio task alongside the clone and
    # asserting it actually got scheduled during the clone, not after.
    source_path = _make_local_bare_repo(tmp_path)
    dest_dir = str(tmp_path / "cloned-concurrent")

    ticks = 0

    async def _ticker() -> None:
        nonlocal ticks
        for _ in range(50):
            await asyncio.sleep(0.01)
            ticks += 1

    ticker_task = asyncio.create_task(_ticker())
    await clone_repository(f"file://{source_path}", token="unused-for-local-clone", dest_dir=dest_dir, timeout_seconds=30)
    ticker_task.cancel()

    assert ticks > 0
