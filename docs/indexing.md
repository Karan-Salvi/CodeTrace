# Indexing

## Goal

Turn a GitHub repository into a set of embedded, retrievable chunks — and
keep that index cheap to update as the repo changes.

## Languages

JS/TS and Python only, via Tree-sitter. Deliberately not chasing broader
language coverage — see `docs/architecture.md` for the reasoning (scope
control over feature breadth).

## Pipeline (full index)

```
Repository selected
        v
Clone (shallow) via GitHub App installation token
        v
Walk file tree
  - skip node_modules, .git, dist, build, coverage, .next, venv, __pycache__
  - skip binaries, generated code
  - skip files above max size threshold
  - skip / redact .env, *.pem, *.key, secrets.*, credentials.*
        v
Tree-sitter parse each remaining file
        v
AST-aware chunking (function / method / class / interface boundaries)
        v
Extract symbol relationships (calls / imports / extends / implements)
  -> symbol_relationships rows, resolved within the repo where possible
        v
For each chunk: SHA-256(content) -> content_hash
        v
content_hash already embedded anywhere? 
  YES -> reuse existing embedding
  NO  -> queue for embedding
        v
Batch embedding calls (respecting provider rate limits)
        v
Store chunk metadata + embedding in Postgres/pgvector
        v
Update repository.status = INDEXED, commit_sha = HEAD
```

Never runs inline on an HTTP request — always a BullMQ job consumed by the
Python worker. The API returns immediately after creating the `index_jobs`
row; the frontend polls/subscribes over WebSocket for progress.

## Chunking strategy

Naive fixed-length text splitting breaks a chunk mid-function and destroys
retrieval quality — a chunk that starts halfway through a function has no
usable signal. Tree-sitter chunks along syntactic boundaries instead:
function, method, class, interface, with parent-scope metadata attached
(e.g. a method chunk knows its enclosing class).

Each chunk stores: `symbol`, `symbol_type`, `parent_symbol`, `language`,
`start_line`, `end_line`, `content_hash`.

## Symbol relationships

Alongside chunk extraction, the same Tree-sitter pass records call/import
edges into `symbol_relationships` (`database.md`) — e.g. `AuthService.login`
calls `UserRepository.findByEmail`. Resolution is best-effort and file/repo
scoped: a call to an unresolvable external package is stored with
`external_target` set and `to_chunk_id` null, rather than dropped, so
"what does this function call externally" is still answerable.

On incremental re-index, a changed file's outgoing edges are deleted and
re-extracted along with its chunks — edges are not diffed independently.

## Incremental indexing (the core performance story)

Triggered by a GitHub `push` webhook.

```
Webhook received
        v
Signature verified (HMAC against GitHub App secret)
        v
event_id already processed? -> YES: ignore (idempotency)
        v NO
Queue incremental-index job
        v
git diff (last_indexed_commit_sha -> new HEAD)
        v
Classify changed paths: added / modified / deleted / renamed
        v
For deleted files: delete associated chunks + embeddings + their symbol_relationships
For added/modified files: re-parse, re-chunk, re-extract symbol_relationships
        v
Chunk-level diff: compare new AST symbols against previously stored ones
  - unchanged function  -> reuse existing chunk + embedding
  - changed function     -> re-embed just that chunk
  - deleted function     -> delete chunk + embedding
  - new function          -> embed
        v
Update repository.commit_sha, log job duration
```

This chunk-level (not just file-level) diffing is what keeps re-index cost
proportional to what actually changed, not to file size. A single-line
change in a 2,000-line file only re-embeds the one touched function.

## Benchmarking

`scripts/benchmark-indexing.sh` runs a full index followed by a small
synthetic change, and reports:

```
Initial Index
-------------
Files: <n>
Chunks: <n>
Embeddings: <n>
Time: <n> sec

Incremental Index
------------------
Files changed: <n>
Chunks changed: <n>
Embeddings: <n>
Time: <n> sec

Time reduction: <n>%
Embedding reduction: <n>%
```

These numbers, measured against a real test repo, are what go in the README
and on the resume — never estimated figures.

## Failure handling

Every stage of the state machine (`docs/database.md` → `index_jobs`) can
fail independently. Retries use exponential backoff, capped attempt count,
then the job is marked `FAILED` with `error_message` populated rather than
silently disappearing. A crashed worker mid-job must leave the job in a
resumable or clearly-failed state — never a job stuck in `EMBEDDING` forever
with no record of what happened.