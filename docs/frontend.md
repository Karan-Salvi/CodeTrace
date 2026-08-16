# Frontend

## Goal

Make the system's engineering work (indexing, hybrid retrieval, evaluation,
PR review) visible and demoable, not just an API surface.

## Structure

React + Vite + TypeScript. REST + WebSocket only against the backend
(`architecture.md`) — no direct DB/queue access, no business logic that
duplicates backend validation.

## Pages

```
Dashboard              repositories, queries, cost summary at a glance
Repository > Overview  status, files/chunks indexed, last indexed commit
Repository > Files     file tree + Monaco viewer, citation-highlight jump
Repository > Ask AI    chat, streamed responses, inline citations
Repository > PR Review list of reviewed PRs, risk score, findings
Repository > Graph     architecture view (architecture-view.md)
Repository > Evaluation latest retrieval/PR eval report (evaluation.md)
Repository > Usage     per-query latency/cost/cache-hit (observability.md)
Repository > Settings  re-sync, delete, critical-directory config (pr-review.md risk factor)
```

## Code explorer

Monaco-based: file tree, syntax-highlighted source, line numbers. A
citation like `auth.service.ts:42-79` in a chat answer or PR finding is a
clickable link that opens the file and scrolls/highlights that range —
this is what makes "grounded" answers concretely verifiable in the UI
instead of just claimed in a response.

## Indexing progress

Subscribed over WebSocket (`backend/src/websocket/handlers/index-progress.handler.ts`),
not polled — job state machine transitions (`database.md: index_jobs`)
are pushed as they happen: files processed, chunks created, embeddings
generated, running against the job's known totals for a progress bar.

## What NOT to build

No offline/PWA support, no mobile-responsive redesign beyond basic
usability, no multi-tenant org switching, no in-browser code editing
(Monaco here is read-only). Matches the scope cuts in `architecture.md`.
