import os
import subprocess
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from src.db import get_engine
from src.indexing.full_index import run_full_index
from src.indexing.incremental_index import run_incremental_index


def _make_local_repo(tmp_path: Path) -> tuple[str, str]:
    """Returns (repo_path, initial_commit_sha). The sha must be a real git
    ref, not a placeholder — the incremental pipeline diffs against it, and
    a fake sha silently fails the diff and disables chunk-level diffing/
    deletion-detection entirely without any test-visible error."""
    src = tmp_path / "source"
    src.mkdir()
    subprocess.run(["git", "init"], cwd=src, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=src, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=src, check=True)
    (src / "auth.ts").write_text(
        "export function handleAuthError(err: Error) {\n  return { status: 401 };\n}\n"
    )
    subprocess.run(["git", "add", "."], cwd=src, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=src, check=True, capture_output=True)
    sha_result = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=src, check=True, capture_output=True, text=True
    )
    return str(src), sha_result.stdout.strip()


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
                "VALUES (:id, :user_id, :installation_id, 'test', 'repo', :url, 'main', 'PENDING', 0, 0, 0, now(), now())"
            ),
            {"id": repository_id, "user_id": user_id, "installation_id": installation_id, "url": "unused"},
        )
    return repository_id


@pytest.mark.asyncio
async def test_incremental_index_reembeds_only_changed_function(tmp_path: Path) -> None:
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path, initial_sha = _make_local_repo(tmp_path)

    with (
         patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
         patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, initial_sha)),
         patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-full-2")

    # modify the function's content -> new content_hash -> must re-embed
    auth_file = os.path.join(local_repo_path, "auth.ts")
    with open(auth_file, "w") as f:  # noqa: ASYNC230
        f.write("export function handleAuthError(err: Error) {\n  return { status: 402 };\n}\n")
    subprocess.run(["git", "add", "."], cwd=local_repo_path, check=True)  # noqa: ASYNC221
    subprocess.run(["git", "commit", "-m", "change status code"], cwd=local_repo_path, check=True, capture_output=True)  # noqa: ASYNC221
    new_sha_result = subprocess.run(  # noqa: ASYNC221
        ["git", "rev-parse", "HEAD"], cwd=local_repo_path, check=True, capture_output=True, text=True
    )
    new_sha = new_sha_result.stdout.strip()

    with (
         patch("src.indexing.incremental_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
         patch("src.indexing.incremental_index.clone_or_reuse", new_callable=AsyncMock, return_value=(local_repo_path, new_sha)),
         patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.2] * 1536])
    ):
        await run_incremental_index(repository_id, job_id="job-inc-1")

    async with engine.connect() as conn:
        chunks = (await conn.execute(
            text("SELECT content FROM chunks WHERE repository_id = :rid AND symbol = 'handleAuthError'"),
            {"rid": repository_id},
        )).fetchall()
        repo_row = (await conn.execute(
            text("SELECT current_commit_sha, status FROM repositories WHERE id = :rid"), {"rid": repository_id}
        )).first()

    assert repo_row is not None
    assert len(chunks) == 1
    assert "402" in chunks[0][0]
    assert repo_row[0] == new_sha
    assert repo_row[1] == "INDEXED"
    await engine.dispose()


@pytest.mark.asyncio
async def test_incremental_index_deletes_chunks_for_a_removed_file(tmp_path: Path) -> None:
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path, initial_sha = _make_local_repo(tmp_path)

    with (
         patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
         patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, initial_sha)),
         patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-full-del-1")

    async with engine.connect() as conn:
        before = (await conn.execute(
            text("SELECT count(*) FROM chunks WHERE repository_id = :rid AND symbol = 'handleAuthError'"),
            {"rid": repository_id},
        )).scalar()
    assert before == 1

    # delete the file entirely
    auth_file = os.path.join(local_repo_path, "auth.ts")
    os.remove(auth_file)
    subprocess.run(["git", "add", "-A"], cwd=local_repo_path, check=True)  # noqa: ASYNC221
    subprocess.run(["git", "commit", "-m", "remove auth.ts"], cwd=local_repo_path, check=True, capture_output=True)  # noqa: ASYNC221
    new_sha_result = subprocess.run(  # noqa: ASYNC221
        ["git", "rev-parse", "HEAD"], cwd=local_repo_path, check=True, capture_output=True, text=True
    )
    new_sha = new_sha_result.stdout.strip()

    with (
         patch("src.indexing.incremental_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
         patch("src.indexing.incremental_index.clone_or_reuse", new_callable=AsyncMock, return_value=(local_repo_path, new_sha)),
         patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[])
    ):
        await run_incremental_index(repository_id, job_id="job-inc-del-1")

    async with engine.connect() as conn:
        chunks_after = (await conn.execute(
            text("SELECT count(*) FROM chunks WHERE repository_id = :rid AND symbol = 'handleAuthError'"),
            {"rid": repository_id},
        )).scalar()
        file_after = (await conn.execute(
            text("SELECT id FROM files WHERE repository_id = :rid AND path = 'auth.ts'"),
            {"rid": repository_id},
        )).first()

    assert chunks_after == 0
    assert file_after is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_incremental_index_removes_stale_rows_when_a_changed_file_becomes_excluded(
    tmp_path: Path,
) -> None:
    # Regression: a file that's in git diff's changed set (still exists at
    # the same path, not "deleted") but now fails should_exclude — grew
    # past max_file_size_bytes here — used to just `continue` past,
    # leaving its old files/chunks/embeddings row stale forever.
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path, initial_sha = _make_local_repo(tmp_path)

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, initial_sha)),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-full-excl-1")

    async with engine.connect() as conn:
        before = (await conn.execute(
            text("SELECT id FROM files WHERE repository_id = :rid AND path = 'auth.ts'"),
            {"rid": repository_id},
        )).first()
    assert before is not None

    auth_file = os.path.join(local_repo_path, "auth.ts")
    oversized_content = "export function handleAuthError() {\n" + ("// pad\n" * 200_000) + "}\n"
    with open(auth_file, "w") as f:  # noqa: ASYNC230
        f.write(oversized_content)
    assert os.path.getsize(auth_file) > 1_048_576
    subprocess.run(["git", "add", "."], cwd=local_repo_path, check=True)  # noqa: ASYNC221
    subprocess.run(["git", "commit", "-m", "grow past max_file_size_bytes"], cwd=local_repo_path, check=True, capture_output=True)  # noqa: ASYNC221
    new_sha_result = subprocess.run(  # noqa: ASYNC221
        ["git", "rev-parse", "HEAD"], cwd=local_repo_path, check=True, capture_output=True, text=True
    )
    new_sha = new_sha_result.stdout.strip()

    with (
        patch("src.indexing.incremental_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.incremental_index.clone_or_reuse", new_callable=AsyncMock, return_value=(local_repo_path, new_sha)),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[])
    ):
        await run_incremental_index(repository_id, job_id="job-inc-excl-1")

    async with engine.connect() as conn:
        after = (await conn.execute(
            text("SELECT id FROM files WHERE repository_id = :rid AND path = 'auth.ts'"),
            {"rid": repository_id},
        )).first()
        chunks_after = (await conn.execute(
            text("SELECT count(*) FROM chunks WHERE repository_id = :rid AND symbol = 'handleAuthError'"),
            {"rid": repository_id},
        )).scalar()

    assert after is None
    assert chunks_after == 0
    await engine.dispose()


@pytest.mark.asyncio
async def test_incremental_index_skips_symlinked_files(tmp_path: Path) -> None:
    # See test_full_index.py's identical regression — same
    # os.walk-lists-symlinks / open()-follows-symlinks gap, same fix,
    # in the incremental pipeline's own walk loop.
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path, initial_sha = _make_local_repo(tmp_path)

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, initial_sha)),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-full-symlink-1")

    secret_target = tmp_path / "host-secret.txt"
    secret_target.write_text("HOST_SECRET_SHOULD_NEVER_BE_INDEXED")
    link_path = os.path.join(local_repo_path, "evil.ts")
    try:
        os.symlink(str(secret_target), link_path)
    except (OSError, NotImplementedError):
        pytest.skip("symlink creation not permitted in this environment (e.g. unprivileged Windows)")
    subprocess.run(["git", "add", "."], cwd=local_repo_path, check=True)  # noqa: ASYNC221
    subprocess.run(["git", "commit", "-m", "add symlink"], cwd=local_repo_path, check=True, capture_output=True)  # noqa: ASYNC221
    new_sha_result = subprocess.run(  # noqa: ASYNC221
        ["git", "rev-parse", "HEAD"], cwd=local_repo_path, check=True, capture_output=True, text=True
    )
    new_sha = new_sha_result.stdout.strip()

    with (
        patch("src.indexing.incremental_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.incremental_index.clone_or_reuse", new_callable=AsyncMock, return_value=(local_repo_path, new_sha)),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_incremental_index(repository_id, job_id="job-inc-symlink-1")

    async with engine.connect() as conn:
        symlink_leak = (await conn.execute(
            text("SELECT id FROM chunks WHERE repository_id = :rid AND content LIKE '%HOST_SECRET_SHOULD_NEVER_BE_INDEXED%'"),
            {"rid": repository_id},
        )).first()
        evil_file = (await conn.execute(
            text("SELECT id FROM files WHERE repository_id = :rid AND path = 'evil.ts'"),
            {"rid": repository_id},
        )).first()

    assert symlink_leak is None
    assert evil_file is None
    await engine.dispose()
