# CodeTrace

AI-powered code intelligence and PR review platform. Indexes a repository at the syntax level, answers questions with grounded citations, and reviews pull requests with contextual, risk-scored feedback.

## Evaluation results

<!-- EVAL_RESULTS_START -->

_Last measured: 2026-08-23T18:55:23.552849+00:00_

**Retrieval quality**

| Config | Recall@5 | Precision@5 | MRR |
| --- | --- | --- | --- |
| Vector | 100% | 12% | 0.97 |
| Keyword | 88% | 58% | 0.75 |
| Hybrid | 100% | 12% | 0.97 |
| Hybrid+Rerank | 100% | 12% | 1.00 |

**PR review**: Precision 0.94, Recall 0.77 (TP=17 FP=1 FN=5)

**Symbol relationships**: Precision 1.00, Recall 1.00

Full numbers: the `/benchmarks` page once deployed, or run the harness yourself — see `evaluation/`.

<!-- EVAL_RESULTS_END -->
