# CodeTrace

AI-powered code intelligence and PR review platform. Indexes a repository at the syntax level, answers questions with grounded citations, and reviews pull requests with contextual, risk-scored feedback.

## Evaluation results

<!-- EVAL_RESULTS_START -->

_Last measured: 2026-08-23T18:29:57.715632+00:00_

**Retrieval quality**

| Config | Recall@5 | Precision@5 | MRR |
| --- | --- | --- | --- |
| Vector | 100% | 12% | 0.97 |
| Keyword | 0% | 0% | 0.00 |
| Hybrid | 100% | 12% | 0.97 |
| Hybrid+Rerank | 100% | 12% | 1.00 |

**PR review**: Precision 0.83, Recall 0.42 (TP=5 FP=1 FN=7)

**Symbol relationships**: Precision 1.00, Recall 1.00

Full numbers: the `/benchmarks` page once deployed, or run the harness yourself — see `evaluation/`.

<!-- EVAL_RESULTS_END -->
