# Plan

## Status

The original scope/positioning brainstorm that lived in this file has been
formalized into the docs below. Treat those as the source of truth — this
file is now just an index plus the scope decisions worth keeping visible.

```
architecture.md         services, why three not one, external AI providers
database.md              full schema incl. symbol_relationships
auth.md                   OAuth login, GitHub App installation, JWT/session mechanics
indexing.md               full + incremental pipeline, symbol extraction
retrieval.md              hybrid search, RRF, reranking, citation validation
pr-review.md              PR pipeline, review categories, risk scoring
architecture-view.md      dependency graph (frontend consumer of symbol_relationships)
frontend.md               pages, code explorer, indexing progress
observability.md          correlation IDs, usage_logs, cost tracking
evaluation.md             retrieval + PR review scoring methodology
security.md               GitHub access, webhook security, prompt injection
deployment.md             EC2 topology, CI/CD, env config
```

## Explicit scope cuts (kept from the original brainstorm)

These stay out regardless of how the project's scope grows elsewhere:

```
Kubernetes / microservices split beyond the 3 documented services
Mobile app
Fine-tuning a model
10+ language support (JS/TS/Python only, by design — indexing.md)
Autonomous coding agent / auto-merge
Complex billing, enterprise SSO, Slack, team management
Multi-repo knowledge graph (symbol_relationships is per-repository)
```

Rationale for keeping this list even though the docs above are now
authoritative: it's easy to accumulate scope by adding features doc-by-doc
without anyone re-checking the sum. This list is the check against that.

## Implementation order

Everything below `backend/prisma/` is currently a 0-byte placeholder — the
docs and the directory tree exist, nothing else does. Not derivable from
any single doc, so recorded here: the dependency chain implementation
should follow, based on what each piece needs already working underneath
it to be testable.

```
1. shared/types                    Prisma-derived types other services import
2. backend: config, database client, core/* (errors, middleware, utils)
3. backend/modules/auth            everything else runs behind auth
4. backend/modules/repositories + webhooks   GitHub App install/webhook intake
5. worker: parsing, embedding, indexing      nothing to retrieve without this
6. backend/modules/retrieval       needs real embeddings to test against
7. backend/modules/chat            needs retrieval
8. backend/modules/pr-review       needs retrieval + symbol_relationships
9. backend/modules/evaluation + evaluation/  needs retrieval + pr-review to score
10. frontend                       needs a working backend API to point at
11. infra/, .github/ workflows     wire once services individually run
```

Database schema (`backend/prisma/schema.prisma`,
`docs/superpowers/specs/2026-08-13-database-schema-design.md`) is complete
and validated — the one piece ahead of this order already, since every
later step depends on the schema being settled first.

## Non-goals worth restating

- No LLM-as-judge evaluation pipeline — `evaluation.md` uses a small
  hand-curated dataset with deterministic scoring.
- No auto-fix / auto-merge from PR review — advisory only (`pr-review.md`).
- No Prometheus/Grafana/distributed tracing — `usage_logs` + correlation
  IDs in structured logs (`observability.md`), added properly only if
  volume actually outgrows log-grep.

## What changed from the original draft

- **Symbol relationships / dependency graph**: was a "nice upgrade" note
  with no schema. Promoted to a real table (`database.md`) and doc
  (`architecture-view.md`) since it's cheap to add while the schema is
  still unwritten, and it's genuine retrieval/PR-review context, not only
  a UI diagram.
- **Risk scoring**: had a concrete point model here but no matching doc,
  while the backend module (`pr-review/services/risk-score.service.ts`)
  already existed in the file tree. Formalized into `pr-review.md` so
  code and doc don't drift apart before either is written.
- **Frontend and observability**: had no doc at all despite being
  referenced throughout (dashboard, Monaco explorer, cost tracking). Added
  minimal docs rather than leaving them implicit.
- **Salary/positioning framing removed**: the original notes mixed
  architecture decisions with resume/compensation strategy in the same
  paragraphs. That framing doesn't belong in a doc future contributors
  (or future you, six months in) will read to understand *why the system
  is built the way it is* — kept the engineering rationale, dropped the
  rest.
