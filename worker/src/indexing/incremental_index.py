import asyncio
import hashlib
import os
import subprocess
import tempfile
import time
import uuid
from typing import Any

from git import Repo
from sqlalchemy import text

from src.config import get_settings
from src.db import get_engine
from src.embedding.batcher import embed_and_store_batch
from src.embedding.embedder import embed_batch  # noqa: F401
from src.embedding.pricing import estimate_embedding_cost_usd
from src.github.clone import clone_repository
from src.github.token_client import fetch_installation_token
from src.indexing.secret_filter import should_exclude
from src.observability import get_logger, write_indexing_usage_log
from src.parsing.ast_chunker import LANGUAGE_BY_EXT, chunk_file
from src.parsing.symbol_relationships import Relationship, extract_relationships


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


async def clone_or_reuse(
    github_url: str, token: str, dest_dir: str, timeout_seconds: int, last_indexed_sha: str | None = None
) -> tuple[str, str]:
    """Re-clone shallow for the incremental pass (worker holds no persistent
    checkout between jobs at this scale) — returns (repo_dir, head_sha).

    clone_repository does a depth=1 shallow clone, which means
    last_indexed_sha is NOT reachable in the fresh clone's history —
    `git diff <last_indexed_sha> HEAD` fails on every incremental run
    otherwise, silently disabling chunk-level diffing entirely. If a prior
    SHA is known, fetch it explicitly so the diff (and therefore deleted-
    file detection) actually works.
    """
    sha = await clone_repository(github_url, token, dest_dir, timeout_seconds)

    if last_indexed_sha:
        try:
            # See clone.py: blocking subprocess.run inside an async
            # function starves the event loop past BullMQ's job-lock
            # renewal window — must run off-loop via to_thread.
            await asyncio.to_thread(
                subprocess.run,
                ["git", "fetch", "--depth", "1", "origin", last_indexed_sha],
                cwd=dest_dir,
                check=True,
                capture_output=True,
                timeout=timeout_seconds,
            )
        except subprocess.CalledProcessError:
            # e.g. history rewritten/force-pushed and last_indexed_sha no
            # longer exists upstream — the caller's diff attempt will fail
            # and fall back to a full re-walk, which is the documented
            # failure-handling behavior for this case.
            pass

    return dest_dir, sha


async def run_incremental_index(repository_id: str, job_id: str) -> None:
    settings = get_settings()
    engine = get_engine()
    logger = get_logger(job_id=job_id, repository_id=repository_id)
    start = time.monotonic()

    async with engine.connect() as conn:
        repo_row = (await conn.execute(
            text("SELECT github_url, current_commit_sha FROM repositories WHERE id = :id"),
            {"id": repository_id},
        )).first()
    if repo_row is None:
        raise ValueError(f"Repository {repository_id} not found")
    github_url, last_indexed_sha = repo_row

    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE repositories SET status = 'CLONING' WHERE id = :id"),
            {"id": repository_id},
        )

    token = await fetch_installation_token(repository_id)

    with tempfile.TemporaryDirectory() as tmp_dir:
        dest_dir = os.path.join(tmp_dir, "repo")
        clone_result = await clone_or_reuse(
            github_url, token, dest_dir, settings.clone_timeout_seconds, last_indexed_sha
        )
        if isinstance(clone_result, tuple):
            actual_repo_dir, new_sha = clone_result
        else:
            actual_repo_dir, new_sha = dest_dir, str(clone_result)

        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE repositories SET status = 'PARSING' WHERE id = :id"),
                {"id": repository_id},
            )

        changed_files: set[str] = set()
        if last_indexed_sha:
            try:
                repo = Repo(actual_repo_dir)
                diff_index = repo.git.diff(last_indexed_sha, "HEAD", "--name-only")
                changed_files = set(diff_index.splitlines()) if diff_index else set()
            except Exception:  # noqa: BLE001
                # last_indexed_sha not present in this shallow clone's
                # history (depth=1) — fall back to a full re-walk
                changed_files = set()

        # indexing.md: "For deleted files: delete associated chunks +
        # embeddings + their symbol_relationships" (embeddings excluded
        # per database.md's never-GC'd cache design — only chunks/files).
        # changed_files from `git diff --name-only` includes deleted paths,
        # but the os.walk below only visits files that still exist on disk
        # — a path in changed_files that's missing from the new clone was
        # deleted and must be removed here, or its stale chunk/embedding
        # rows would silently degrade retrieval quality forever.
        if changed_files:
            deleted_files = {
                rel_path for rel_path in changed_files
                if not os.path.exists(os.path.join(actual_repo_dir, rel_path))
            }
            if deleted_files:
                async with engine.begin() as conn:
                    for rel_path in deleted_files:
                        # ON DELETE CASCADE on chunks.file_id removes the
                        # file's chunks (and symbol_relationships via
                        # their own cascade) automatically.
                        await conn.execute(
                            text("DELETE FROM files WHERE repository_id = :rid AND path = :path"),
                            {"rid": repository_id, "path": rel_path},
                        )
                logger.info(f"deleted {len(deleted_files)} file(s) removed from the repository")

        files_processed = 0
        chunks_created = 0
        embeddings_generated = 0
        cache_hits = 0
        all_chunk_rows: list[dict[str, Any]] = []
        all_relationship_specs: list[tuple[str, list[Relationship]]] = []

        walk_targets = changed_files if changed_files else None

        for root, _dirs, filenames in os.walk(actual_repo_dir):
            if ".git" in root:
                continue
            for filename in filenames:
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, actual_repo_dir).replace("\\", "/")

                if walk_targets is not None and rel_path not in walk_targets:
                    continue

                # See full_index.py: os.walk lists symlinked files even
                # with followlinks=False, and open() later would
                # transparently follow one to an arbitrary host path. Git
                # can commit symlinks and a real Linux clone recreates
                # them — must skip before any stat/read.
                if os.path.islink(full_path):
                    continue

                size_bytes = os.path.getsize(full_path)
                ext = os.path.splitext(filename)[1]
                language = LANGUAGE_BY_EXT.get(ext)
                if should_exclude(rel_path, size_bytes, settings.max_file_size_bytes) or language is None:
                    # This path changed (git diff) and still exists on disk,
                    # but no longer qualifies for indexing (grew past
                    # max_file_size_bytes, renamed to match a secret
                    # pattern, extension changed to an unsupported
                    # language, etc). If it was previously indexed, its old
                    # files/chunks/embeddings row is now stale and must be
                    # removed — same "never leave stale rows behind"
                    # requirement as the deleted-file branch above, just
                    # triggered by an exclusion-transition instead of an
                    # actual git deletion. ON DELETE CASCADE on
                    # chunks.file_id handles chunks/symbol_relationships.
                    async with engine.begin() as conn:
                        await conn.execute(
                            text("DELETE FROM files WHERE repository_id = :rid AND path = :path"),
                            {"rid": repository_id, "path": rel_path},
                        )
                    continue

                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:  # noqa: ASYNC230
                    content = f.read()

                files_processed += 1

                async with engine.begin() as conn:
                    existing_file = (await conn.execute(
                        text("SELECT id FROM files WHERE repository_id = :rid AND path = :path"),
                        {"rid": repository_id, "path": rel_path},
                    )).first()

                    if existing_file:
                        file_id = existing_file[0]
                        # chunk-level diff: delete this file's old chunks
                        # (and their edges via FK cascade) before re-chunking
                        await conn.execute(
                            text("DELETE FROM chunks WHERE file_id = :fid"), {"fid": file_id}
                        )
                        await conn.execute(
                            text(
                                "UPDATE files SET content_hash = :hash, size_bytes = :size, "
                                "last_indexed_sha = :sha, updated_at = now() WHERE id = :id"
                            ),
                            {"hash": _content_hash(content), "size": size_bytes, "sha": new_sha, "id": file_id},
                        )
                    else:
                        file_id = str(uuid.uuid4())
                        await conn.execute(
                            text(
                                "INSERT INTO files (id, repository_id, path, language, content_hash, "
                                "size_bytes, last_indexed_sha, created_at, updated_at) "
                                "VALUES (:id, :rid, :path, :lang, :hash, :size, :sha, now(), now())"
                            ),
                            {
                                "id": file_id, "rid": repository_id, "path": rel_path,
                                "lang": language, "hash": _content_hash(content),
                                "size": size_bytes, "sha": new_sha,
                            },
                        )

                chunks = chunk_file(content, language)
                relationships = extract_relationships(content, language, chunks)
                all_relationship_specs.append((file_id, relationships))

                for chunk in chunks:
                    chunks_created += 1
                    all_chunk_rows.append({
                        "file_id": file_id,
                        "chunk_id": str(uuid.uuid4()),
                        "symbol": chunk.symbol,
                        "symbol_type": chunk.symbol_type,
                        "parent_symbol": chunk.parent_symbol,
                        "language": language,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "content": chunk.content,
                        "content_hash": _content_hash(chunk.content),
                    })

        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE repositories SET status = 'EMBEDDING', files_indexed = :n WHERE id = :id"),
                {"n": files_processed, "id": repository_id},
            )

        to_embed = [(str(row["content_hash"]), str(row["content"])) for row in all_chunk_rows]
        cache_results = await embed_and_store_batch(engine, to_embed, settings.embedding_model_version)
        cache_hits = sum(1 for hit in cache_results.values() if hit)
        embeddings_generated = len(cache_results) - cache_hits

        hash_to_content: dict[str, str] = {
            str(row["content_hash"]): str(row["content"]) for row in all_chunk_rows
        }
        newly_embedded_chars = sum(
            len(hash_to_content[content_hash])
            for content_hash, is_cache_hit in cache_results.items()
            if not is_cache_hit
        )
        embedding_cost_usd = estimate_embedding_cost_usd(newly_embedded_chars)

        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE repositories SET status = 'STORING' WHERE id = :id"),
                {"id": repository_id},
            )

        # See full_index.py for why this is keyed both ways: a global
        # bare-symbol map alone lets two different files' same-named
        # functions silently collide (last one inserted wins), resolving
        # relationship edges to the wrong file's chunk. from_symbol is
        # always same-file and must resolve via the scoped map;
        # to_symbol_or_external has no real import/scope resolution here
        # (extract_relationships is text-based) so same-file is
        # preferred, global kept only as a best-effort fallback.
        symbol_to_chunk_id: dict[str, str] = {}
        scoped_symbol_to_chunk_id: dict[tuple[str, str], str] = {}
        async with engine.begin() as conn:
            for row in all_chunk_rows:
                await conn.execute(
                    text(
                        "INSERT INTO chunks (id, repository_id, file_id, symbol, symbol_type, "
                        "parent_symbol, language, start_line, end_line, content, content_hash, "
                        "embedding_model_version, created_at) "
                        "VALUES (:id, :rid, :file_id, :symbol, CAST(:symbol_type AS \"SymbolType\"), "
                        ":parent_symbol, :language, :start_line, :end_line, :content, :content_hash, "
                        ":model_version, now())"
                    ),
                    {
                        "id": row["chunk_id"], "rid": repository_id, "file_id": row["file_id"],
                        "symbol": row["symbol"], "symbol_type": row["symbol_type"],
                        "parent_symbol": row["parent_symbol"], "language": row["language"],
                        "start_line": row["start_line"], "end_line": row["end_line"],
                        "content": row["content"], "content_hash": row["content_hash"],
                        "model_version": settings.embedding_model_version,
                    },
                )
                symbol_str = str(row["symbol"])
                file_id_str = str(row["file_id"])
                symbol_to_chunk_id[symbol_str] = str(row["chunk_id"])
                scoped_symbol_to_chunk_id[(file_id_str, symbol_str)] = str(row["chunk_id"])

            for file_id, relationships in all_relationship_specs:
                for rel in relationships:
                    from_chunk_id = scoped_symbol_to_chunk_id.get((file_id, str(rel.from_symbol)))
                    if from_chunk_id is None:
                        continue
                    to_symbol_str = str(rel.to_symbol_or_external)
                    to_chunk_id = scoped_symbol_to_chunk_id.get(
                        (file_id, to_symbol_str)
                    ) or symbol_to_chunk_id.get(to_symbol_str)
                    await conn.execute(
                        text(
                            "INSERT INTO symbol_relationships "
                            "(id, repository_id, from_chunk_id, to_chunk_id, relationship_type, "
                            "external_target, created_at) "
                            "VALUES (:id, :rid, :from_id, :to_id, CAST(:rel_type AS \"RelationshipType\"), "
                            ":external, now())"
                        ),
                        {
                            "id": str(uuid.uuid4()), "rid": repository_id,
                            "from_id": from_chunk_id, "to_id": to_chunk_id,
                            "rel_type": rel.relationship_type,
                            "external": None if to_chunk_id else rel.to_symbol_or_external,
                        },
                    )

            await conn.execute(
                text(
                    "UPDATE repositories SET status = 'INDEXED', current_commit_sha = :sha, "
                    "embedding_cost_usd = embedding_cost_usd + :cost "
                    "WHERE id = :id"
                ),
                {"sha": new_sha, "cost": embedding_cost_usd, "id": repository_id},
            )

        duration_ms = int((time.monotonic() - start) * 1000)
        cache_hit_rate = cache_hits / len(cache_results) if cache_results else 0.0

        await write_indexing_usage_log(
            engine,
            repository_id=repository_id,
            job_id=job_id,
            duration_ms=duration_ms,
            files_processed=files_processed,
            chunks_created=chunks_created,
            embeddings_generated=embeddings_generated,
            cache_hit_rate=cache_hit_rate,
            cost_usd=embedding_cost_usd,
        )

        logger.info(f"incremental index complete: {files_processed} files changed, {chunks_created} chunks")
