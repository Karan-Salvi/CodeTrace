# Evaluation

## Why this exists

Most "RAG over codebase" projects stop at "it worked when I tried it."
CodeTrace treats retrieval and PR-review quality as measurable, versioned
outputs — this is the single biggest differentiator of the project and
should not be cut for time (see `docs/architecture.md` scope notes).

Lives in `evaluation/`, separate from both `backend/` and `worker/` — it's
infrastructure for validating the whole system, not a script owned by one
service.

```
evaluation/
├── datasets/
│   ├── qa_questions.json
│   └── pr_scenarios.json
├── runner/
│   ├── retrieval_eval.py
│   └── pr_eval.py
├── metrics/
│   └── recall_precision_mrr.py
└── reports/
```

## Retrieval evaluation

`datasets/qa_questions.json` — 15-20 hand-written questions against a real
test repository, each with the expected chunk(s) that should be retrieved.

`runner/retrieval_eval.py` runs each question through four retrieval
configurations and scores each:

```
Vector only
Keyword only
Hybrid (RRF)
Hybrid + Reranking
```

Metrics computed by `metrics/recall_precision_mrr.py`:

| metric      | meaning                                                |
| ----------- | ------------------------------------------------------ |
| Recall@5    | was the expected chunk in the top 5 results?           |
| Precision@5 | what fraction of the top 5 were relevant?              |
| MRR         | how high up was the first relevant result, on average? |

Output format:

```
                    Vector   Keyword   Hybrid   Hybrid+Rerank

Recall@5              61%       54%      82%        86%
Precision@5           58%       49%      78%        82%
MRR                   0.61      0.55     0.79       0.84
```

These are the numbers that go in the README and in the resume bullet —
**only measured values, never estimates.**

## Answer evaluation

Beyond retrieval, the actual generated answers are checked for:

- **Citation correctness** — every cited file/line actually exists and was
  part of retrieved context (this reuses the citation validator described
  in `retrieval.md`).
- **Groundedness** — does the answer's claim actually follow from the
  retrieved chunks, or does it go beyond what's supported?
- **Relevance** — does the answer address the question asked?

A small deterministic checklist is enough here — this does not need a full
LLM-as-judge system.

## Symbol relationship evaluation

`symbol_relationships` (`database.md`) is extracted heuristically during
AST parsing (`indexing.md`) — resolution can silently produce wrong edges
(e.g. a call resolved to the wrong overload, or a dynamic/reflective call
missed entirely) with no natural signal that it happened, unlike a bad
chunk which at least shows up as bad retrieval.

A small hand-labeled check against the same test repository used for
retrieval eval: 20-30 known call/import edges, checked for
precision (extracted edges that are actually real) and recall (real edges
that got extracted). Reuses the existing test-repo fixture rather than a
separate dataset. Not a blocking gate — a manual spot-check run alongside
the retrieval eval, since a fully automated ground-truth extraction would
itself need an independent parser to validate against.

## PR review evaluation

`datasets/pr_scenarios.json` — 10-15 constructed PR scenarios with known,
labeled issues, e.g.:

```
SQL injection
missing authorization check
transaction not rolled back on failure
null/undefined handling
race condition
missing test coverage for changed logic
```

`runner/pr_eval.py` runs the PR review pipeline against each scenario and
measures:

```
true positives   (real issue, correctly flagged)
false positives   (flagged something that isn't actually an issue)
false negatives   (real issue, missed)
precision / recall
```

This turns "the AI reviewer seems good" into a scored, reproducible claim.

## Running evaluations

One-time (or after editing `evaluation/datasets/*.json` or
`evaluation/fixtures/`) setup — seeds a dedicated fixture repository
(`codetrace-eval/fixture-repo`, real embeddings via the real Gemini API,
never touches real user repositories) and writes a short-lived auth token
to `evaluation/.eval-fixture.json` (git-ignored):

```
cd backend && npm run seed:eval-fixture
```

Then, with the backend dev server running:

```
python evaluation/runner/retrieval_eval.py                 # all 4 configs
python evaluation/runner/retrieval_eval.py --config hybrid  # one config
python evaluation/runner/pr_eval.py
```

And, offline (no server needed — imports the worker's real parser
directly, run from the worker's own venv):

```
worker/.venv/Scripts/python.exe evaluation/runner/symbol_relationship_eval.py
```

Each of the three scoring scripts writes to `evaluation/reports/` as
timestamped JSON + a human-readable `.md` summary, so historical runs can
be compared as retrieval strategy changes over time (e.g. before/after
adding reranking). The fixture's auth token expires (~15 min) —
re-run `seed:eval-fixture` if a runner returns `401`.

## Publishing results publicly

The numbers above only prove anything if someone other than you can see
them. `evaluation/runner/publish_results.py` turns the latest reports into
two committed artifacts, run manually as a deliberate "publish" step
(never automatic, consistent with this doc's "no continuous eval-on-every-
commit" stance):

```
python evaluation/runner/publish_results.py
```

It reads the newest `*_retrieval.json` / `*_pr_review.json` in
`evaluation/reports/`, re-runs `symbol_relationship_eval.py` for a fresh
number, and writes:

- **`frontend/public/eval-results.json`** — a plain static asset (not an
  API response) served as-is by Vite. The public, unauthenticated
  `/benchmarks` page (`frontend/src/pages/EvalResults.tsx`) fetches this
  file at runtime — no backend route, no database access, so there is
  nothing here that can leak real-user data.
- **`README.md`** — regenerates the markdown table between
  `<!-- EVAL_RESULTS_START -->` / `<!-- EVAL_RESULTS_END -->` markers, so
  the same numbers shown on `/benchmarks` also render directly on the
  GitHub repo page.

Both files are checked in — commit them after every publish run so the
public page and the README move together. Re-running is idempotent (the
marker block gets replaced in place, not duplicated).

## What NOT to build here

No full LLM-as-judge pipeline, no continuous eval-on-every-commit
infrastructure. A small, hand-curated dataset run manually (or in CI as a
single job, see `deployment.md`) is enough to produce a defensible,
interview-ready number — building more than that is scope creep for a
portfolio project.
