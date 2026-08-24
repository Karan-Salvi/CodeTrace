# Retrieval

## Goal

Given a natural-language question or a PR diff, return the chunks most
likely to ground a correct, citable answer — reliably enough that every
claim in the output can point to a real file/line.

## Why hybrid, not vector-only

Pure vector similarity search under-performs on exact identifier lookups.
Searching for `handleAuthError` semantically often ranks paraphrased or
loosely related code above the literal function, because embeddings
capture meaning, not exact tokens. CodeTrace combines two retrieval paths
and merges them.

## Pipeline

```
User question
      v
Query preprocessing
      v
Query classification (heuristic, not ML)
  - contains an exact symbol / camelCase / snake_case token? -> keyword-heavy
  - otherwise                                                  -> vector-heavy
      v
Hybrid retrieval (both paths always run - classification reweights RRF, never skips a path)
  +-------------------+-------------------+
  v                                       v
pgvector cosine similarity      PostgreSQL full-text search (tsvector)
  on embeddings                   on symbol/identifier names
  +-------------------+-------------------+
                v
    Reciprocal Rank Fusion (RRF) merge -> top ~20
                v
            Reranker -> top 5-8
                v
        Context assembly (chunk text + file path + line range)
                v
                LLM
                v
        Citation validation
                v
        Streaming response
```

## Reciprocal Rank Fusion

Instead of picking a single winner between the vector and keyword result
lists, both ranked lists are merged by rank position (not raw score, which
isn't comparable across the two methods). This avoids needing to
hand-tune a weighting coefficient between semantic and keyword relevance.

Query classification does not exclude a retrieval path — running only
vector or only keyword search would lose recall whenever the heuristic
misclassifies a mixed query (e.g. "why does handleAuthError throw on
expired tokens" has both an identifier and a semantic question). Instead
the classification adjusts the RRF constant per path (keyword path gets a
lower-k / higher-weight constant when the query looks identifier-heavy,
and vice versa), so a misclassification degrades ranking rather than
dropping a path's results entirely.

## Reranking

Runs backend-side (`backend/src/modules/retrieval/services/reranker.service.ts`)
as a call to a hosted cross-encoder reranking API — not a locally-loaded
model. A self-hosted reranker was considered and rejected: the EC2 target
(`deployment.md`) budgets 2 GB RAM for all three services plus Postgres and
Redis, which doesn't comfortably fit a cross-encoder model in the backend
process. This keeps the backend stateless/lightweight at the cost of one
extra external API call per query, which is already the pattern used for
the LLM and embedding calls.

## Metadata filtering

Retrieval can be scoped by `language`, `repository_id`, `branch`, and
`symbol_type` before ranking, to avoid irrelevant cross-language or
cross-repo noise entering the candidate set.

## Citation validation

The LLM is not trusted to self-report accurate citations. Every citation in
a generated response is checked against what was actually retrieved:

```
Does this file/chunk exist in this repository?
Does this chunk belong to the repository being queried?
Are the line numbers valid for this chunk?
Was this chunk part of the retrieved context (not hallucinated)?
```

If a citation fails validation, the unsupported claim is stripped or the
response is regenerated. This is what allows CodeTrace to claim "grounded"
answers rather than "answers that mention file names."

## Hallucination guard

If retrieval confidence is low (e.g. top result rank/score below a
threshold, or an empty result set), the system returns:

> "I couldn't find enough evidence in this repository to answer
> confidently."

rather than forcing the LLM to produce a plausible-sounding but ungrounded
answer.

## Evaluation

Retrieval quality is not asserted, it's measured — see `evaluation.md`. A
fixed 34-question set against a real test repo is scored for
Recall@8, Precision@8, and MRR across four configurations:

```
Vector only
Keyword only
Hybrid (RRF)
Hybrid + Reranking
```

The delta between these runs is the retrieval-engineering story for the
resume and for interviews — not a claim, a measured comparison.
