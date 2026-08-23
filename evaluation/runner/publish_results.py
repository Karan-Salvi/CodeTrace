# evaluation/runner/publish_results.py
#
# Combines the most recent retrieval_eval.py / pr_eval.py report with a
# fresh symbol_relationship_eval.py run into one committed snapshot for
# public display: frontend/public/eval-results.json (served as-is by
# Vite, no backend involved — fetched at runtime by the public
# /benchmarks page) and a matching markdown table injected into
# README.md between EVAL_RESULTS_START/END markers.
#
# This is a deliberate, manual "publish" step — nothing here runs
# automatically. Run retrieval_eval.py and pr_eval.py first, then this.
#
# Usage: python evaluation/runner/publish_results.py

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "runner"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "worker"))
from symbol_relationship_eval import run_check as run_symbol_relationship_check  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REPORTS_DIR = REPO_ROOT / "evaluation" / "reports"
OUTPUT_JSON_PATH = REPO_ROOT / "frontend" / "public" / "eval-results.json"
README_PATH = REPO_ROOT / "README.md"

START_MARKER = "<!-- EVAL_RESULTS_START -->"
END_MARKER = "<!-- EVAL_RESULTS_END -->"

RETRIEVAL_CONFIG_ORDER = ["Vector", "Keyword", "Hybrid", "Hybrid+Rerank"]


def latest_report(suffix: str) -> dict:
    matches = sorted(REPORTS_DIR.glob(f"*_{suffix}.json"))
    if not matches:
        raise SystemExit(
            f"No evaluation/reports/*_{suffix}.json found — run the corresponding "
            f"runner script (retrieval_eval.py / pr_eval.py) first."
        )
    return json.loads(matches[-1].read_text())


def build_snapshot() -> dict:
    retrieval = latest_report("retrieval")
    pr_review = latest_report("pr_review")
    symbol_relationships = run_symbol_relationship_check()

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "retrieval": retrieval,
        "prReview": {
            "truePositives": pr_review["truePositives"],
            "falsePositives": pr_review["falsePositives"],
            "falseNegatives": pr_review["falseNegatives"],
            "precision": pr_review["precision"],
            "recall": pr_review["recall"],
        },
        "symbolRelationships": {
            "precision": symbol_relationships["precision"],
            "recall": symbol_relationships["recall"],
        },
    }


def format_readme_table(snapshot: dict) -> str:
    lines = [
        START_MARKER,
        "",
        f"_Last measured: {snapshot['generatedAt']}_",
        "",
        "**Retrieval quality**",
        "",
        "| Config | Recall@5 | Precision@5 | MRR |",
        "| --- | --- | --- | --- |",
    ]
    for config in RETRIEVAL_CONFIG_ORDER:
        if config not in snapshot["retrieval"]:
            continue
        row = snapshot["retrieval"][config]
        lines.append(
            f"| {config} | {row['recall_at_5'] * 100:.0f}% | {row['precision_at_5'] * 100:.0f}% | {row['mrr']:.2f} |"
        )

    pr = snapshot["prReview"]
    sr = snapshot["symbolRelationships"]
    lines += [
        "",
        "**PR review**: "
        f"Precision {pr['precision']:.2f}, Recall {pr['recall']:.2f} "
        f"(TP={pr['truePositives']} FP={pr['falsePositives']} FN={pr['falseNegatives']})",
        "",
        "**Symbol relationships**: "
        f"Precision {sr['precision']:.2f}, Recall {sr['recall']:.2f}",
        "",
        "Full numbers: the `/benchmarks` page once deployed, or run the harness "
        "yourself — see `evaluation/`.",
        "",
        END_MARKER,
    ]
    return "\n".join(lines)


def update_readme(snapshot: dict) -> None:
    table = format_readme_table(snapshot)
    existing = README_PATH.read_text(encoding="utf-8") if README_PATH.exists() else ""

    if START_MARKER in existing and END_MARKER in existing:
        start = existing.index(START_MARKER)
        end = existing.index(END_MARKER) + len(END_MARKER)
        new_content = existing[:start] + table + existing[end:]
    elif existing.strip():
        new_content = existing.rstrip() + "\n\n## Evaluation results\n\n" + table + "\n"
    else:
        new_content = (
            "# CodeTrace\n\n"
            "AI-powered code intelligence and PR review platform. Indexes a repository "
            "at the syntax level, answers questions with grounded citations, and reviews "
            "pull requests with contextual, risk-scored feedback.\n\n"
            "## Evaluation results\n\n" + table + "\n"
        )

    README_PATH.write_text(new_content, encoding="utf-8")


def main() -> None:
    snapshot = build_snapshot()

    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON_PATH.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON_PATH}")

    update_readme(snapshot)
    print(f"Updated {README_PATH}")


if __name__ == "__main__":
    main()
