# evaluation/metrics/recall_precision_mrr.py

CONFIG_ORDER = ["Vector", "Keyword", "Hybrid", "Hybrid+Rerank"]


def format_retrieval_table(results: dict[str, dict[str, float]]) -> str:
    configs = [c for c in CONFIG_ORDER if c in results]
    header = "                    " + "   ".join(f"{c:>13}" for c in configs)

    def row(label: str, key: str, as_percent: bool) -> str:
        cells = []
        for c in configs:
            value = results[c][key]
            cells.append(f"{value * 100:>12.0f}%" if as_percent else f"{value:>13.2f}")
        return f"{label:<20}" + "   ".join(cells)

    lines = [
        header,
        "",
        row("Recall@5", "recall_at_5", True),
        row("Precision@5", "precision_at_5", True),
        row("MRR", "mrr", False),
    ]
    return "\n".join(lines)
