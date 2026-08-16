# PR Review

## Goal

Given an opened/updated pull request, produce grounded, file/line-cited
feedback with a transparent risk score — not a generic "looks good to me"
or a wall of style nits.

## Pipeline

```
GitHub pull_request webhook (opened / synchronize)
        v
Signature verified + idempotency check (webhook_events, see database.md)
        v
Queue pr-review job
        v
Fetch diff via GitHub API (installation token)
        v
Identify changed symbols
  - map changed line ranges onto chunks (database.md: chunks.start_line/end_line)
  - a changed symbol is any chunk whose range overlaps the diff
        v
Retrieve dependencies
  - walk symbol_relationships (database.md) one hop from each changed symbol
  - pulls in callers/callees so the reviewer sees usage context, not just the diff
        v
Retrieve related tests
  - heuristic: same symbol name referenced in a file matching a test path pattern
  - this is the same "has test coverage" check the risk score's
    "no test file touched" factor reuses below, not a second mechanism
        v
Hybrid retrieval (retrieval.md) for any additional context the diff references
        v
Rerank -> top context set
        v
AI review -> structured findings (see Review categories)
        v
Citation validation (retrieval.md) - every finding's file/line must be real
        v
Risk score (see Risk scoring)
        v
Store pr_reviews row, respond via webhook-triggered GitHub check/comment
```

Runs as a queued job (`pr-review` queue), same as indexing — never inline
on the webhook request.

## Review categories

Every finding is tagged, not freeform prose:

```
BUG
SECURITY
PERFORMANCE
LOGIC
TESTING
MAINTAINABILITY
```

A finding without a concrete reason (e.g. "maybe rename this variable")
is not emitted — the prompt constrains the model to only report findings
it can tie to a specific correctness, security, performance, or
test-coverage concern. Style-only nits are explicitly out of scope for v1.

Each finding carries: `category`, `file`, `line`, `explanation`,
`related_symbol` (if from `symbol_relationships` context), and a citation
validated the same way chat citations are (`retrieval.md`).

## Risk scoring

A transparent, additive point model — not an opaque LLM-assigned number —
so the score is explainable in review output and defensible in an
interview.

```
Base risk = 0

+20  touches an authentication/authorization code path
+20  touches a payment code path
+15  includes a database migration
+10  >500 lines changed
+10  adds/changes a dependency (package.json / requirements.txt / pyproject.toml)
+10  no test file touched alongside changed source (uses the same
     symbol-name/test-path heuristic as "Retrieve related tests" above —
     one implementation, two consumers)
+5   touches a directory flagged as critical (configurable per repository)
```

```
0-30    LOW
31-60   MEDIUM
61-100  HIGH
```

Score factors are returned alongside the score (which triggered, how much
each contributed) — never just a bare number. Path/keyword matching for
"touches auth/payment" is heuristic (path patterns + symbol names), not ML,
consistent with the query-classification approach in `retrieval.md`.

## Evaluation

PR review quality is scored the same way retrieval is — see
`evaluation.md` for the `pr_scenarios.json` dataset and true/false
positive/negative methodology. Risk-score weights above are the initial
values; if evaluation shows a factor over/under-triggering against the
labeled scenarios, tune the weights and re-run, don't hand-adjust based on
a single PR.

## What NOT to build

No auto-merge, no auto-fix / auto-commit suggestions applied without
review, no blocking CI on risk score (advisory only for v1). Matches the
scope cuts already made in `architecture.md` / `plan.md`.
