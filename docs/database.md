# Database

PostgreSQL with the `pgvector` extension. Schema is owned entirely by the
backend service via Prisma; the worker writes to the same database using a
connection string but never runs migrations.

The executable form of this design is `backend/prisma/schema.prisma` +
`backend/prisma/sql/indexes.sql`, derived via
`docs/superpowers/specs/2026-08-13-database-schema-design.md` (which also
records the design decisions and worker invariants in full).

## Tables

```
users
sessions
repositories
repository_installations
files
chunks
commits
embeddings
index_jobs
webhook_events
conversations
messages
pull_requests
pr_reviews
usage_logs
eval_questions
eval_runs
eval_results
symbol_relationships
```

### `users`
GitHub-authenticated user. No email/password auth — GitHub OAuth only.

| column | notes |
|---|---|
| github_id | unique, the OAuth upsert key (`auth.md`) |
| username, email, avatar_url | from GitHub profile, refreshed on login |
| github_access_token | encrypted at rest, used for API calls on the user's behalf (not session auth) |

Refresh tokens live in `sessions`, not here — see below.

### `sessions`
One row per device/login (`auth.md`). Logging in on a second device doesn't
invalidate the first; "log out everywhere" revokes all of a user's rows.

| column | notes |
|---|---|
| user_id | |
| refresh_token_hash | hashed, not the raw token — revocable/checkable without storing it plaintext |
| user_agent, ip_address | optional, for a "your sessions" display |
| expires_at, revoked_at | a session is valid only if unexpired and unrevoked |

### `repositories`
One row per connected repo.

| column | notes |
|---|---|
| owner, name, github_url | |
| default_branch | |
| current_commit_sha | last successfully indexed commit |
| status | `PENDING / CLONING / PARSING / CHUNKING / EMBEDDING / STORING / INDEXED / FAILED` |
| files_indexed, chunks_indexed | for dashboard display |
| embedding_cost_usd | running total |

### `repository_installations`
GitHub App installation metadata: installation ID, token, permission scope,
revoked flag. Separate from `repositories` because one installation can cover
multiple repos — `repositories.installation_id` points here. Uninstall sets
`revoked_at` (rows are never deleted in normal operation); repository rows
survive for history/re-install, but every serving/index/webhook path checks
the flag and refuses revoked installations.

### `files`
Tracked file per repo: path, language, content hash, size, last indexed
commit SHA. Used to short-circuit re-indexing of unchanged files.

### `chunks`
The unit of retrieval. One row per AST-extracted symbol.

| column | notes |
|---|---|
| repository_id, file_id | |
| symbol, symbol_type | e.g. `handleAuthError`, `function` |
| parent_symbol | enclosing class/module, if any |
| language | |
| start_line, end_line | |
| content | the chunk's source text — the backend has no repo clone, so retrieval context assembly reads this |
| content_hash | SHA-256 of chunk text — cache key into `embeddings` |
| embedding_model_version | which model's vector this chunk targets; worker writes it from `EMBEDDING_MODEL_VERSION` env, mismatch vs current = needs re-embed |

### `embeddings`
A content-addressed cache, not per-chunk rows: primary key
`(content_hash, model_version)`, `vector(1536)` column (pgvector; Gemini
`gemini-embedding-001`, MRL-truncated to 1536 dims), **no repository or
chunk FK** — chunks point *into* this table, and a chunk from repo A and
a chunk from repo B with identical text share one row. That's what makes
cross-repo reuse a shared row instead of a copied vector. `model_version`
in the key means a provider/model swap is just cache misses for the new
version — old vectors are never silently mixed into the new vector space.
ANN search uses an HNSW index (`backend/prisma/sql/indexes.sql`).

Write-order invariant: the worker upserts embedding rows *before* inserting
chunks (the chunk→embedding FK enforces it). Orphaned embeddings are never
auto-deleted — deliberate (re-adding a repo = instant cache hits); a manual
GC query exists in the spec if disk ever matters.

### `commits`
Indexed commit history per repo — supports the git-diff-based incremental
indexing flow (`indexing.md`).

### `index_jobs`
State machine for indexing runs (full or incremental).

```
PENDING -> CLONING -> PARSING -> CHUNKING -> EMBEDDING -> STORING -> INDEXED
              (any state) -> FAILED -> RETRY -> PENDING
```

Tracked fields: `attempt_count`, `started_at`, `completed_at`,
`error_message`, `duration_ms`.

### `webhook_events`
Every received GitHub webhook, keyed by GitHub's `event_id`, for idempotent
processing (GitHub redelivers webhooks; duplicates must be detected and
skipped).

### `conversations` / `messages`
Q&A chat history per repository. Kept intentionally minimal — no branching
threads, just a linear message list per conversation. Assistant messages
also store `citations` (the validated file/line refs, so the frontend's
citation-jump works off stored data) and `retrieval_meta` (chunks retrieved
vs. cited, feeding `observability.md`).

### `pull_requests`
One row per PR the backend has seen via webhook.

| column | notes |
|---|---|
| repository_id, github_pr_number | |
| title, author, base_sha, head_sha | |
| status | `OPEN / MERGED / CLOSED` |
| last_reviewed_sha | which head SHA the latest `pr_reviews` row covers — a new push gets a new review, not a mutated old one |

### `pr_reviews`
One row per review run (a PR can have several, one per push).

| column | notes |
|---|---|
| pull_request_id, commit_sha | |
| risk_score, risk_level | see `pr-review.md` |
| risk_factors | JSON: which of the additive factors triggered and their point value — the score is never stored without its breakdown |
| findings | JSON array: `category, file, line, explanation, related_symbol, citation` per `pr-review.md` |
| status | `PENDING / RUNNING / COMPLETE / FAILED` — same failure-visibility principle as `index_jobs` |
| duration_ms, llm_cost_usd | feeds `observability.md` |

### `usage_logs`
Per-query observability: retrieval latency, LLM latency, tokens, cost,
chunks retrieved vs. chunks actually cited, cache hit/miss.

### `eval_questions` / `eval_runs` / `eval_results`
The evaluation harness's own tables — a hand-written question set, each
scored run (vector-only / hybrid / hybrid+reranked), and per-question
results (retrieved vs. expected chunk, correct/incorrect). Both questions
and runs carry a `repository_id` FK. Expected/retrieved chunks are stored
as `{path, symbol}` identities, **not** chunk UUIDs — chunk rows are
hard-deleted and recreated on re-index, so UUIDs churn; path+symbol stays
stable and is resolved to live chunk IDs at eval runtime.

### `symbol_relationships`
Edges of the call/dependency graph, one row per relationship.

| column | notes |
|---|---|
| repository_id | |
| from_chunk_id | the calling symbol |
| to_chunk_id | the called/imported symbol, nullable if target isn't resolvable (external package) |
| relationship_type | `CALLS / IMPORTS / EXTENDS / IMPLEMENTS` |
| external_target | package/module name, set only when `to_chunk_id` is null |

Populated during AST chunking (`indexing.md`), not a separate pass — a
plain PostgreSQL table, not a graph database, since the query patterns
needed (symbol's callers/callees, one-hop traversal for context expansion)
don't justify one. Re-derived from scratch on every full/incremental index
of the affected file, same as chunks — no incremental diffing of edges
themselves, just of the chunks that produce them. Both chunk FKs cascade on
delete, so removing a chunk removes its edges automatically. No unique
constraint on `(from, to, type)` — Postgres treats NULL external targets as
distinct in unique indexes, so dedupe (or repeat-counts as edge weight) is
the worker's job.

Used by: retrieval context expansion (pull in a called function even if it
didn't independently rank in hybrid search), PR review (flag a changed
function whose callers aren't covered by the diff), and the architecture
view (`architecture-view.md`).

## Key indexes

```
repositories(user_id)
sessions(refresh_token_hash)      -- unique
files(repository_id, path)
chunks(file_id)
chunks(repository_id, symbol)
chunks(content_hash)
commits(repository_id, sha)
webhook_events(event_id)          -- unique, enforces idempotency
usage_logs(repository_id, created_at)
symbol_relationships(repository_id, from_chunk_id)
symbol_relationships(repository_id, to_chunk_id)

-- raw SQL (backend/prisma/sql/indexes.sql), Prisma can't express these:
embeddings USING hnsw (vector vector_cosine_ops)
chunks USING gin (to_tsvector('simple', symbol || parent_symbol || content))
```

FTS uses the `'simple'` config, not `'english'` — code identifiers must not
be stemmed; exact-identifier matching is the point of the keyword path
(`retrieval.md`).

## Design notes

- **Content-hash caching lives at the `chunks`/`embeddings` boundary.**
  Before embedding a chunk, the worker checks whether a chunk with the same
  `content_hash` already has an embedding anywhere in the system (not just
  this repo) — this is what makes monorepo boilerplate/config nearly free to
  re-index.
- **`webhook_events(event_id)` unique constraint** is the actual idempotency
  mechanism, not application-level logic alone — enforcing it at the DB
  layer means a race between two webhook deliveries can't both succeed.
- **No soft deletes on `chunks`/`embeddings`** for deleted symbols — they're
  hard-deleted on incremental re-index when a symbol disappears from a diff,
  since keeping stale vectors around silently degrades retrieval quality.