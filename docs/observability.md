# Observability & Cost Tracking

## Goal

Every query and job should be traceable end-to-end, and every dollar spent
on embeddings/LLM calls should be attributable to a repository — not
estimated after the fact.

## Correlation IDs

```
request_id   per HTTP request
repository_id
query_id     per chat question
job_id       per index/PR-review job
```

Propagated across API -> Redis (job payload) -> Worker -> Database -> LLM
call, and included in every log line touching that request/job, so a
single slow or failed query can be traced across all three services
without guessing which worker picked it up.

## Metrics recorded (`usage_logs`, see `database.md`)

```
Indexing     duration, files processed, chunks created, embeddings
             generated, cache hit rate (content_hash reuse, indexing.md),
             embedding cost
Q&A          retrieval latency, reranking latency, LLM latency, total
             latency, tokens, cost, chunks retrieved vs. chunks actually
             cited (retrieval.md citation validation)
PR review    processing time, files analyzed, chunks retrieved, LLM cost
```

Cost is computed from provider-reported token usage per call, not
estimated from text length — the same numbers that feed the
`embedding_cost_usd` running total on `repositories` (`database.md`).

## What this is for

- **Dashboard usage tab** (`frontend.md`) — per-repository latency/cost
  display, not just a raw log dump.
- **Cost optimization claims** — "cache reduces embedding cost by X%",
  "reranked top-8 vs raw top-20 changes LLM cost by Y%" are things this
  data can actually answer, instead of being asserted in the README
  without a source.

## What NOT to build

No dedicated metrics stack (Prometheus/Grafana) for v1 — `usage_logs` in
Postgres plus the dashboard usage tab is enough at this scale. No
distributed tracing backend (Jaeger/Tempo) — correlation IDs in structured
logs are sufficient for a three-service system this size. Add either only
if query volume or debugging need actually outgrows log-grep, not
speculatively.
