import hashlib
import os
import tempfile
import time
import uuid

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
from src.parsing.symbol_relationships import extract_relationships


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


async def run_full_index(repository_id: str, job_id: str) -> None:
    settings = get_settings()
    engine = get_engine()
    logger = get_logger(job_id=job_id, repository_id=repository_id)
    start = time.monotonic()

    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE repositories SET status = 'CLONING' WHERE id = :id"),
            {"id": repository_id},
        )

    logger.info("fetching installation token")
    token = await fetch_installation_token(repository_id)

    async with engine.connect() as conn:
        repo_row = (await conn.execute(
            text("SELECT github_url FROM repositories WHERE id = :id"), {"id": repository_id}
        )).first()
    if repo_row is None:
        raise ValueError(f"Repository {repository_id} not found")
    github_url = repo_row[0]

    with tempfile.TemporaryDirectory() as tmp_dir:
        dest_dir = os.path.join(tmp_dir, "repo")
        clone_result = await clone_repository(github_url, token, dest_dir, settings.clone_timeout_seconds)
        # clone_repository returns a bare sha in production; tests patch a
        # (path, sha) tuple to redirect the clone target for local fixtures
        if isinstance(clone_result, tuple):
            actual_repo_dir, commit_sha = clone_result
        else:
            actual_repo_dir, commit_sha = dest_dir, clone_result

        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE repositories SET status = 'PARSING' WHERE id = :id"),
                {"id": repository_id},
            )

        files_processed = 0
        chunks_created = 0
        embeddings_generated = 0
        cache_hits = 0

        from typing import Any
        all_chunk_rows: list[dict[str, Any]] = []
        from src.parsing.symbol_relationships import Relationship
        all_relationship_specs: list[tuple[str, list[Relationship]]] = []

        for root, _dirs, filenames in os.walk(actual_repo_dir):
            if ".git" in root:
                continue
            for filename in filenames:
                full_path = os.path.join(root, filename)

                # security.md: repository content is untrusted. Git can
                # commit symlinks (mode 120000) and a real `git clone` on
                # Linux (the actual deployment target) recreates them as
                # real filesystem symlinks by default. os.walk's
                # followlinks=False (the default, and what's used here)
                # only stops directory traversal — it still lists a
                # symlinked FILE in filenames, and a plain open() later
                # transparently follows it. Without this check, any user
                # indexing their own repo could commit a symlink pointing
                # at an arbitrary host path (/etc/passwd, another
                # process's env, etc.) and have its content silently
                # read, embedded, and served back through chat/retrieval
                # as if it were real repository code.
                if os.path.islink(full_path):
                    continue

                rel_path = os.path.relpath(full_path, actual_repo_dir)
                size_bytes = os.path.getsize(full_path)

                if should_exclude(rel_path, size_bytes, settings.max_file_size_bytes):
                    continue

                ext = os.path.splitext(filename)[1]
                language = LANGUAGE_BY_EXT.get(ext)
                if language is None:
                    continue

                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:  # noqa: ASYNC230
                    content = f.read()

                files_processed += 1

                # indexing.md: "a crashed worker mid-job must leave the job
                # in a resumable... state" — but a plain INSERT here means
                # any retry of a job that got even partially through this
                # loop fails immediately on files_repository_id_path_key
                # (unique constraint), before BullMQ's retry can ever
                # succeed. Upsert on (repository_id, path) instead, and use
                # the RETURNING id (the row's real, possibly pre-existing
                # id) for this file's chunks — never a freshly generated
                # uuid that might not match an existing row and would
                # violate chunks.file_id's FK into files.
                async with engine.begin() as conn:
                    file_row = (await conn.execute(
                        text(
                            "INSERT INTO files (id, repository_id, path, language, content_hash, "
                            "size_bytes, last_indexed_sha, created_at, updated_at) "
                            "VALUES (:id, :rid, :path, :lang, :hash, :size, :sha, now(), now()) "
                            "ON CONFLICT (repository_id, path) DO UPDATE SET "
                            "language = EXCLUDED.language, content_hash = EXCLUDED.content_hash, "
                            "size_bytes = EXCLUDED.size_bytes, last_indexed_sha = EXCLUDED.last_indexed_sha, "
                            "updated_at = now() "
                            "RETURNING id"
                        ),
                        {
                            "id": str(uuid.uuid4()), "rid": repository_id, "path": rel_path,
                            "lang": language, "hash": _content_hash(content),
                            "size": size_bytes, "sha": commit_sha,
                        },
                    )).first()
                    assert file_row is not None
                    file_id = str(file_row[0])

                    # A retry re-parses this file from scratch — any
                    # chunks from a prior (crashed) attempt against the
                    # same file row must be cleared first, or this would
                    # duplicate every symbol instead of replacing them.
                    await conn.execute(
                        text("DELETE FROM chunks WHERE file_id = :file_id"),
                        {"file_id": file_id},
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

        # Worker invariant: embeddings upserted before chunks (FK requires it).
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

        # Keyed by bare symbol name AND by (file_id, symbol) — two
        # different files defining a same-named function/method (e.g.
        # two unrelated "login" methods) used to silently collide in a
        # single global-name map: whichever chunk was inserted last won,
        # so relationship edges could resolve to the wrong file's chunk
        # entirely with no error. from_symbol is always same-file (it's
        # the enclosing chunk found by _find_symbol_for_node within that
        # file's own chunk list) so it can — and must — resolve via the
        # scoped map. to_symbol_or_external has no real scope/import
        # resolution in this codebase (extract_relationships is
        # text-based, not a resolver) — same-file match is preferred
        # first since that's the common case, with the global map kept
        # only as a best-effort fallback for legitimate cross-file calls.
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

            # Every file actually seen this walk was upserted above with
            # last_indexed_sha = commit_sha. Anything still carrying an
            # older sha was not visited this run — deleted from the repo,
            # renamed, or newly excluded (secret pattern, size limit,
            # unsupported extension) — and is now a stale row whose
            # chunks/embeddings would otherwise silently keep degrading
            # retrieval forever, same as the deleted-file case
            # incremental_index.py already handles. A full index is
            # authoritative over the whole tree, so this is the one place
            # that can safely clean up every such case in one sweep.
            await conn.execute(
                text(
                    "DELETE FROM files WHERE repository_id = :rid AND last_indexed_sha != :sha"
                ),
                {"rid": repository_id, "sha": commit_sha},
            )

            await conn.execute(
                text(
                    "UPDATE repositories SET status = 'INDEXED', current_commit_sha = :sha, "
                    "chunks_indexed = :n, embedding_cost_usd = :cost WHERE id = :id"
                ),
                {"sha": commit_sha, "n": chunks_created, "cost": embedding_cost_usd, "id": repository_id},
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

        logger.info(f"full index complete: {files_processed} files, {chunks_created} chunks")
