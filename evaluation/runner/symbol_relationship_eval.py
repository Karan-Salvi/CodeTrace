# evaluation/runner/symbol_relationship_eval.py
#
# Not a blocking gate (docs/evaluation.md) — a manual spot-check of the
# real worker extractor (worker/src/parsing/symbol_relationships.py)
# against 18 hand-labeled known edges, reusing the eval fixture repo.
# Imports the worker's real chunk_file/extract_relationships directly —
# does not read the DB-seeded symbol_relationships table (those are
# inserted directly from the same manifest this compares against, which
# would make the check circular).
#
# Usage: python evaluation/runner/symbol_relationship_eval.py
# Requires worker/ on the Python path — run from the worker's own venv,
# e.g.: worker/.venv/Scripts/python.exe evaluation/runner/symbol_relationship_eval.py

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "worker"))

from src.parsing.ast_chunker import chunk_file  # noqa: E402
from src.parsing.symbol_relationships import extract_relationships  # noqa: E402

FIXTURES_SRC_DIR = REPO_ROOT / "evaluation" / "fixtures" / "src"
MANIFEST_PATH = REPO_ROOT / "evaluation" / "fixtures" / "manifest.json"
EXPECTED_PATH = REPO_ROOT / "evaluation" / "datasets" / "symbol_relationships.json"


def run_check() -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text())
    expected_edges = json.loads(EXPECTED_PATH.read_text())

    language_by_file = {entry["path"]: entry["language"] for entry in manifest}
    files_checked = sorted(set(e["file"] for e in expected_edges))

    extracted_edges: list[dict] = []
    for file_path in files_checked:
        content = (FIXTURES_SRC_DIR / file_path).read_text()
        language = language_by_file[file_path]
        chunks = chunk_file(content, language)
        relationships = extract_relationships(content, language, chunks)
        for rel in relationships:
            extracted_edges.append(
                {"file": file_path, "type": rel.relationship_type, "from_symbol": rel.from_symbol, "to": rel.to_symbol_or_external}
            )

    def edge_key(e: dict) -> tuple:
        return (e["file"], e["type"], e["from_symbol"], e["to"])

    expected_set = {edge_key(e) for e in expected_edges}
    extracted_set = {edge_key(e) for e in extracted_edges}

    true_positives = expected_set & extracted_set
    false_positives = extracted_set - expected_set
    false_negatives = expected_set - extracted_set

    precision = len(true_positives) / len(extracted_set) if extracted_set else 0.0
    recall = len(true_positives) / len(expected_set) if expected_set else 0.0

    return {
        "expectedEdges": len(expected_set),
        "extractedEdges": len(extracted_set),
        "truePositives": len(true_positives),
        "falsePositives": len(false_positives),
        "falseNegatives": len(false_negatives),
        "precision": precision,
        "recall": recall,
        "falsePositiveEdges": sorted(false_positives),
        "falseNegativeEdges": sorted(false_negatives),
    }


def main() -> None:
    result = run_check()

    print(f"Expected edges: {result['expectedEdges']}")
    print(f"Extracted edges: {result['extractedEdges']}")
    print(f"True positives: {result['truePositives']}")
    print(f"False positives (extracted but not expected): {result['falsePositives']}")
    for fp in result["falsePositiveEdges"]:
        print(f"  + {fp}")
    print(f"False negatives (expected but not extracted): {result['falseNegatives']}")
    for fn in result["falseNegativeEdges"]:
        print(f"  - {fn}")
    print(f"\nPrecision: {result['precision']:.2f}  Recall: {result['recall']:.2f}")


if __name__ == "__main__":
    main()
