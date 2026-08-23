# evaluation/metrics/test_recall_precision_mrr.py
from recall_precision_mrr import format_retrieval_table


def test_format_retrieval_table_includes_all_configs_and_percentages():
    results = {
        "Vector": {"recall_at_5": 0.61, "precision_at_5": 0.58, "mrr": 0.61},
        "Keyword": {"recall_at_5": 0.54, "precision_at_5": 0.49, "mrr": 0.55},
        "Hybrid": {"recall_at_5": 0.82, "precision_at_5": 0.78, "mrr": 0.79},
        "Hybrid+Rerank": {"recall_at_5": 0.86, "precision_at_5": 0.82, "mrr": 0.84},
    }

    table = format_retrieval_table(results)

    assert "Vector" in table
    assert "Keyword" in table
    assert "Hybrid" in table
    assert "Hybrid+Rerank" in table
    assert "61%" in table
    assert "86%" in table
    assert "0.84" in table


def demo() -> None:
    results = {
        "Vector": {"recall_at_5": 0.61, "precision_at_5": 0.58, "mrr": 0.61},
        "Hybrid+Rerank": {"recall_at_5": 0.86, "precision_at_5": 0.82, "mrr": 0.84},
    }
    print(format_retrieval_table(results))


if __name__ == "__main__":
    demo()
