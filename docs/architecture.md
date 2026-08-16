# Architecture

## Overview

CodeTrace is an AI-powered code intelligence and PR review platform. It indexes
a user's GitHub repositories at the syntax level, answers questions about the
codebase with grounded citations, and reviews pull requests with contextual,
risk-scored feedback.

The system is split into three independently deployable services connected
through Postgres and Redis, rather than a single monolith. This lets the
CPU/memory-heavy indexing workload scale independently of the request-serving
API.

## High-level diagram

```
                         GitHub
                            |
               +------------+------------+
               |                         |
             OAuth                    Webhooks
               |                         |
               +------------+------------+
                            v
                    +--------------+
                    |   API Layer  |
                    | Node/Express |
                    +------+-------+
                           |
             +-------------+-------------+
             v             v             v
        PostgreSQL       Redis        GitHub API
        + pgvector      BullMQ
             ^             |
             |             v
             |       +--------------+
             |       | Index Worker |
             |       |   Python     |
             |       +------+-------+
             |              |
             |       +------+------+
             |       v             v
             |   Tree-sitter   Embeddings
             |        |
             |        v
             |  symbol_relationships (call/import graph)
             |
             v
       Hybrid Retrieval
       +------+------+
       v             v
   pgvector       PostgreSQL FTS
       +------+------+
              v
          Reranking
              v
       Context Assembly (+ 1-hop symbol_relationships expansion)
              v
             LLM
              v
       +--------------+
       | React/Vite   |
       | Dashboard    |
       | + Graph view |
       +--------------+
```

## Services

### Frontend (`frontend/`)

React + Vite + TypeScript. Talks to the backend over REST and WebSocket
(streaming Q&A responses, live indexing progress). No direct database or
queue access.

### Backend API (`backend/`)

Node.js + Express + TypeScript, organized as domain modules
(`modules/auth`, `modules/repositories`, `modules/chat`,
`modules/pr-review`, `modules/webhooks`, etc.). Responsibilities:

- GitHub OAuth + GitHub App installation flow
- Repository lifecycle (add, sync, delete, status)
- Receiving and validating GitHub webhooks (push, pull_request, installation)
- Enqueuing indexing/PR-review jobs onto Redis via BullMQ (producer only)
- Serving hybrid retrieval + Q&A + PR review endpoints
- Owning all Prisma migrations — no other service touches schema

The backend **never** runs CPU-heavy parsing or embedding itself. It queues
work and reads results.

### Worker (`worker/`)

Python service, consumes jobs from the same Redis queues the backend
produces to. Responsibilities:

- Cloning repositories
- AST-aware chunking via Tree-sitter (JS/TS, Python)
- Embedding generation (batched, content-hash cached)
- Incremental re-indexing via git diff
- Secret/binary/generated-code filtering before anything is embedded

Chosen as a separate Python service (not a Node worker) primarily because
embedding/reranking/ML tooling is Python-first — the worker needs Python
regardless of what parses the code. Given that, Tree-sitter runs there too
rather than splitting AST parsing into a 4th runtime; both Node and Python
Tree-sitter bindings are viable today, so this is a "don't add a language"
decision, not a bindings-quality one. This also means the worker's memory
footprint can be scaled and monitored independently of the API.

## Why three services instead of a monolith

- Indexing is bursty and memory-heavy (parsing + batched embeddings); the API
  is not. Coupling them means a large repo index can starve API request
  handling.
- Failure isolation: a worker crash mid-embedding should not take down
  request-serving.
- Matches a legitimate, common production pattern (JS API layer + Python
  ML/processing service), which is defensible in a systems-design
  conversation.

## Deployment topology

MVP runs all three services + Postgres + Redis on a single AWS EC2 instance
via `infra/docker-compose.single-vm.yml`. The repo also ships (unused, for
now) `docker-compose.backend.yml` / `docker-compose.worker.yml` so the worker
can be moved to its own VM later without any code changes — only environment
variables and network/security-group configuration change. See
`deployment.md`.

## External AI providers

LLM (chat + PR review generation), embedding, and reranking are all
hosted API calls, not self-hosted models — consistent with the 2 GB EC2
memory budget (`deployment.md`). Provider choice is an implementation
detail behind `backend/src/modules/chat/services/llm.service.ts` and the
worker's `embedding/embedder.py`, not fixed here, but the contract is:

- Swappable via env var (`LLM_PROVIDER`, `EMBEDDING_PROVIDER`) — no
  provider-specific code outside those two modules.
- Current embedding default: Gemini `gemini-embedding-001`, MRL-truncated
  to 1536 dims via `output_dimensionality` (free-tier usage covers
  build/test/demo scale). The pgvector column is fixed at `vector(1536)`,
  and the cache key includes `model_version` (`database.md`) — so swapping
  embedding models is an env change plus a full re-index, never a schema
  migration, and never a silent mix of two vector spaces.
- On LLM timeout/failure: retry with backoff up to a capped attempt count
  (same pattern as job retries, `indexing.md`), then surface a clear
  "temporarily unavailable" response rather than hanging the request —
  this is one of the explicit security/reliability test cases
  (`security.md`).
- On embedding provider failure mid-batch: the batch fails as a unit and
  the index job retries that batch, it does not partially commit
  embeddings for some chunks and silently skip others.

## Cross-cutting design decisions

- **Env-var-only configuration.** No hardcoded hostnames (`redis`,
  `postgres`) in code — always `REDIS_URL` / `DATABASE_URL` from environment,
  so single-VM and split-VM deployments require zero code changes.
- **Backend owns migrations exclusively.** Worker only reads/writes against
  an already-migrated schema.
- **Webhooks only ever hit the backend.** The worker never receives inbound
  traffic; this holds true whether it's co-located or on its own VM.
