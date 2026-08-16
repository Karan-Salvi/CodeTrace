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


def _make_local_repo(tmp_path: Path) -> str:
    src = tmp_path / "source"
    src.mkdir()
    subprocess.run(["git", "init"], cwd=src, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=src, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=src, check=True)
    (src / "auth.ts").write_text(
        "export function handleAuthError(err: Error) {\n  return { status: 401 };\n}\n"
    )
    (src / ".env").write_text("SECRET=should-never-be-indexed\n")
    subprocess.run(["git", "add", "."], cwd=src, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=src, check=True, capture_output=True)
    return str(src)


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
async def test_full_index_creates_chunks_and_skips_secret_files(tmp_path: Path) -> None:
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path = _make_local_repo(tmp_path)

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, "abc123")),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):

        await run_full_index(repository_id, job_id="job-full-1")

    async with engine.connect() as conn:
        chunks = (await conn.execute(
            text("SELECT symbol FROM chunks WHERE repository_id = :rid"), {"rid": repository_id}
        )).fetchall()
        repo_row = (await conn.execute(
            text("SELECT status, files_indexed, chunks_indexed FROM repositories WHERE id = :rid"),
            {"rid": repository_id},
        )).first()

    assert repo_row is not None
    symbols = {row[0] for row in chunks}
    assert "handleAuthError" in symbols
    assert repo_row[0] == "INDEXED"
    assert repo_row[2] >= 1

    # .env content must never appear as chunk content anywhere
    async with engine.connect() as conn:
        env_leak = (await conn.execute(
            text("SELECT id FROM chunks WHERE repository_id = :rid AND content LIKE '%should-never-be-indexed%'"),
            {"rid": repository_id},
        )).first()
    assert env_leak is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_full_index_can_be_retried_against_a_repository_it_already_indexed(tmp_path: Path) -> None:
    # indexing.md: "a crashed worker mid-job must leave the job in a
    # resumable... state". BullMQ (attempts: 3) will retry a failed job
    # by re-running run_full_index from scratch — this must not blow up
    # on files_repository_id_path_key just because a prior attempt
    # (successful or partial) already inserted rows for this repository.
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path = _make_local_repo(tmp_path)

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, "sha-attempt-1")),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-retry-1")

    # Retry: same repository, same files on disk, simulating BullMQ
    # re-running the job after a mid-pipeline failure on the first pass.
    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, "sha-attempt-2")),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.2] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-retry-2")

    async with engine.connect() as conn:
        chunks = (await conn.execute(
            text(
                "SELECT symbol FROM chunks WHERE repository_id = :rid AND symbol = 'handleAuthError'"
            ),
            {"rid": repository_id},
        )).fetchall()
        files = (await conn.execute(
            text("SELECT id, last_indexed_sha FROM files WHERE repository_id = :rid AND path = 'auth.ts'"),
            {"rid": repository_id},
        )).fetchall()
        repo_row = (await conn.execute(
            text("SELECT status, current_commit_sha FROM repositories WHERE id = :rid"),
            {"rid": repository_id},
        )).first()

    # exactly one chunk survives (the retry's chunks, not a duplicate
    # alongside the first attempt's), exactly one file row (upserted, not
    # duplicated), and the repository reflects the retry's own commit sha
    assert len(chunks) == 1
    assert len(files) == 1
    assert files[0][1] == "sha-attempt-2"
    assert repo_row is not None
    assert repo_row[0] == "INDEXED"
    assert repo_row[1] == "sha-attempt-2"
    await engine.dispose()


@pytest.mark.asyncio
async def test_full_index_removes_stale_rows_for_files_no_longer_present(tmp_path: Path) -> None:
    # Regression: a full re-index only ever upserted files it visited this
    # walk — a file removed (or renamed, or newly excluded) between two
    # full-index runs kept its old files/chunks/embeddings row forever,
    # silently degrading retrieval. A full index is authoritative over the
    # whole tree, so anything not touched this run (last_indexed_sha still
    # the prior commit) must be swept.
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path = _make_local_repo(tmp_path)

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, "sha-1")),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[[0.1] * 1536])
    ):
        await run_full_index(repository_id, job_id="job-sweep-1")

    async with engine.connect() as conn:
        before = (await conn.execute(
            text("SELECT id FROM files WHERE repository_id = :rid AND path = 'auth.ts'"),
            {"rid": repository_id},
        )).first()
    assert before is not None

    # remove auth.ts from disk and re-run a full index without it, as if
    # a fresh clone of a later commit no longer contains this file
    os.remove(os.path.join(local_repo_path, "auth.ts"))

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, "sha-2")),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, return_value=[])
    ):
        await run_full_index(repository_id, job_id="job-sweep-2")

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


def _make_local_repo_with_duplicate_symbol_names(tmp_path: Path) -> str:
    # Two different files each define a "login" function that calls its
    # own file-local "helper" — plausible real-world collision (common
    # names like "login"/"validate"/"handleError" reused across modules).
    src = tmp_path / "source-dup"
    src.mkdir()
    subprocess.run(["git", "init"], cwd=src, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=src, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=src, check=True)
    (src / "moduleA.ts").write_text(
        "function helper() { return 'A'; }\n"
        "export function login() { console.log('module A'); return helper(); }\n"
    )
    (src / "moduleB.ts").write_text(
        "function helper() { return 'B'; }\n"
        "export function login() { console.log('module B'); return helper(); }\n"
    )
    subprocess.run(["git", "add", "."], cwd=src, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=src, check=True, capture_output=True)
    return str(src)


@pytest.mark.asyncio
async def test_full_index_resolves_same_named_symbols_to_their_own_file(tmp_path: Path) -> None:
    # Regression: symbol_to_chunk_id was a single global dict keyed only
    # by bare symbol name. Two files each defining "login" (calling their
    # own file-local "helper") used to collide — whichever chunk was
    # inserted last silently won the dict slot, so a CALLS edge could
    # resolve to a different file's chunk entirely with no error.
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)
    local_repo_path = _make_local_repo_with_duplicate_symbol_names(tmp_path)

    with (
        patch("src.indexing.full_index.fetch_installation_token", new_callable=AsyncMock, return_value="unused"),
        patch("src.indexing.full_index.clone_repository", new_callable=AsyncMock, return_value=(local_repo_path, "sha-dup-1")),
        patch("src.embedding.batcher.embed_batch", new_callable=AsyncMock, side_effect=lambda texts: [[0.1] * 1536 for _ in texts])
    ):
        await run_full_index(repository_id, job_id="job-dup-1")

    async with engine.connect() as conn:
        rows = (await conn.execute(
            text(
                "SELECT f.path, c.id, c.symbol FROM chunks c "
                "JOIN files f ON f.id = c.file_id "
                "WHERE c.repository_id = :rid AND c.symbol IN ('login', 'helper')"
            ),
            {"rid": repository_id},
        )).fetchall()

        rel_rows = (await conn.execute(
            text(
                "SELECT sr.from_chunk_id, sr.to_chunk_id FROM symbol_relationships sr "
                "JOIN chunks fc ON fc.id = sr.from_chunk_id "
                "JOIN chunks tc ON tc.id = sr.to_chunk_id "
                "WHERE sr.repository_id = :rid AND fc.symbol = 'login' AND tc.symbol = 'helper'"
            ),
            {"rid": repository_id},
        )).fetchall()

    chunk_id_by_path_and_symbol = {(row[0], row[2]): row[1] for row in rows}
    assert len(chunk_id_by_path_and_symbol) == 4  # 2 files x (login, helper), no collision

    # Every login-calls-helper edge must point at the specific chunk_id of
    # its OWN file's helper, not merely "some file whose path matches" —
    # the bug resolved every edge's from_chunk_id to whichever file's
    # login was inserted last, so a path-only check can pass by
    # coincidence even when both edges are wrongly attributed to the same
    # file. Checking exact chunk_ids closes that gap.
    expected_edges = {
        (chunk_id_by_path_and_symbol[("moduleA.ts", "login")], chunk_id_by_path_and_symbol[("moduleA.ts", "helper")]),
        (chunk_id_by_path_and_symbol[("moduleB.ts", "login")], chunk_id_by_path_and_symbol[("moduleB.ts", "helper")]),
    }
    actual_edges = {(str(row[0]), str(row[1])) for row in rel_rows}
    assert actual_edges == expected_edges
    await engine.dispose()
