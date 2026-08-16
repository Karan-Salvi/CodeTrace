import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from src.cli import run_index_command
from src.db import get_engine


@pytest.mark.asyncio
async def test_run_index_command_invokes_full_index() -> None:
    with patch("src.cli.run_full_index", new_callable=AsyncMock) as mock_full:
        await run_index_command(repository_id="repo-cli-1")

    mock_full.assert_called_once()
    call_args = mock_full.call_args
    assert call_args.args[0] == "repo-cli-1"


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
                "VALUES (:id, :user_id, :installation_id, 'test', 'repo', 'unused', 'main', 'PARSING', 0, 0, 0, now(), now())"
            ),
            {"id": repository_id, "user_id": user_id, "installation_id": installation_id},
        )
    return repository_id


@pytest.mark.asyncio
async def test_run_index_command_marks_repository_failed_on_error() -> None:
    get_engine.cache_clear()
    engine = get_engine()
    repository_id = await _seed_repository(engine)

    with (
        patch("src.cli.run_full_index", new_callable=AsyncMock, side_effect=RuntimeError("boom")),
        pytest.raises(RuntimeError, match="boom"),
    ):
        await run_index_command(repository_id=repository_id)

    async with engine.connect() as conn:
        repo_row = (await conn.execute(
            text("SELECT status FROM repositories WHERE id = :id"), {"id": repository_id}
        )).first()

    assert repo_row is not None
    assert repo_row[0] == "FAILED"
    await engine.dispose()


@pytest.mark.asyncio
async def test_run_index_command_reraises_original_error_when_mark_failed_itself_fails() -> None:
    # Regression: mark_repository_failed's own INSERT INTO index_jobs has
    # a foreign-key constraint on repository_id. If repository_id doesn't
    # exist (never seeded, or a bad id from the caller), that write fails
    # with a ForeignKeyViolationError that used to propagate in place of
    # the original pipeline error — masking the real failure reason.
    get_engine.cache_clear()
    engine = get_engine()
    nonexistent_repository_id = str(uuid.uuid4())

    with (
        patch("src.cli.run_full_index", new_callable=AsyncMock, side_effect=RuntimeError("original failure")),
        pytest.raises(RuntimeError, match="original failure"),
    ):
        await run_index_command(repository_id=nonexistent_repository_id)

    await engine.dispose()
