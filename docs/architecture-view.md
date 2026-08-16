# Architecture View

## Goal

Turn `symbol_relationships` (`database.md`) into a visual dependency graph
in the frontend — the one feature that makes AST-level analysis visible
instead of implicit in retrieval quality.

## Data flow

```
GET /repositories/:id/graph?scope=<file|symbol>&root=<symbol_id?>
        v
Repository-level authorization check (auth.md / security.md) -
  same as every other repository-scoped route, no exception for read-only graph data
        v
Backend queries symbol_relationships, 1-2 hops from root
(or whole-file granularity when no root given — repo-wide graphs are
never rendered node-per-symbol, only node-per-file, to stay readable)
        v
Response: { nodes: [...], edges: [...] }
        v
Frontend renders with React Flow
```

## Granularity

Two zoom levels, not a continuous graph:

- **File-level** (default): nodes are files, edges are aggregated
  import/call relationships between them. This is what renders for a
  whole-repository view.
- **Symbol-level**: nodes are individual functions/classes, edges are
  actual calls. Only rendered scoped to a single root symbol (e.g. "show
  what `AuthService.login` calls, and what calls it") — never the whole
  repo at once, since a real codebase's full call graph is unreadable as a
  single diagram and expensive to lay out client-side.

## Use beyond the dashboard

- **Retrieval context expansion**: when a chunk ranks highly, its direct
  callees can be pulled into LLM context even if they didn't independently
  rank (`retrieval.md`).
- **PR review**: a changed function's callers (from `symbol_relationships`)
  are checked for test coverage — "this function changed and none of its
  3 callers have an associated test" is a stronger signal than diff-only
  analysis (`pr-review.md`).

## What NOT to build

No force-directed whole-repo graph, no live-updating graph during
indexing, no editing the graph. Read-only, query-scoped, two fixed zoom
levels — matches the scope-control precedent set in `architecture.md`.
