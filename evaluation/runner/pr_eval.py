# evaluation/runner/pr_eval.py
#
# Calls the real, already-tested backend evaluation endpoint
# (POST /evaluation/pr-run) once per PR scenario and aggregates the real
# true/false positive/negative counts it returns (micro-averaged).
#
# Usage:
#   python evaluation/runner/pr_eval.py
#   python evaluation/runner/pr_eval.py --dataset evaluation/datasets/pr_scenarios.json

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURE_MANIFEST_PATH = REPO_ROOT / "evaluation" / ".eval-fixture.json"
DEFAULT_DATASET_PATH = REPO_ROOT / "evaluation" / "datasets" / "pr_scenarios.json"
REPORTS_DIR = REPO_ROOT / "evaluation" / "reports"


def load_fixture_manifest() -> dict:
    if not FIXTURE_MANIFEST_PATH.exists():
        raise SystemExit(
            f"{FIXTURE_MANIFEST_PATH} not found — run "
            "`npm run seed:eval-fixture` (from backend/) first."
        )
    return json.loads(FIXTURE_MANIFEST_PATH.read_text())


def run_scenario(base_url: str, token: str, pull_request_id: str, scenario: dict) -> dict:
    resp = requests.post(
        f"{base_url}/evaluation/pr-run",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "pullRequestId": pull_request_id,
            "changedRanges": [
                {"filePath": scenario["filePath"], "startLine": scenario["startLine"], "endLine": scenario["endLine"]}
            ],
            "labeledIssues": [{"category": scenario["category"], "file": scenario["filePath"]}],
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["data"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET_PATH))
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    fixture = load_fixture_manifest()
    scenarios = json.loads(Path(args.dataset).read_text())

    total_tp = total_fp = total_fn = 0
    per_scenario: dict[str, dict] = {}

    for scenario in scenarios:
        pull_request_id = fixture["pullRequestIds"].get(scenario["name"])
        if not pull_request_id:
            raise SystemExit(
                f"No seeded pull request for scenario '{scenario['name']}' — "
                "re-run `npm run seed:eval-fixture` after updating pr_scenarios.json."
            )
        print(f"Running scenario: {scenario['name']}...")
        result = run_scenario(args.base_url, fixture["token"], pull_request_id, scenario)
        per_scenario[scenario["name"]] = result
        total_tp += result["truePositives"]
        total_fp += result["falsePositives"]
        total_fn += result["falseNegatives"]

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0

    summary = {
        "truePositives": total_tp,
        "falsePositives": total_fp,
        "falseNegatives": total_fn,
        "precision": precision,
        "recall": recall,
        "perScenario": per_scenario,
    }

    print(f"\nTP={total_tp} FP={total_fp} FN={total_fn} Precision={precision:.2f} Recall={recall:.2f}")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    (REPORTS_DIR / f"{timestamp}_pr_review.json").write_text(json.dumps(summary, indent=2))
    (REPORTS_DIR / f"{timestamp}_pr_review.md").write_text(
        f"# PR Review Evaluation — {timestamp}\n\n"
        f"TP={total_tp} FP={total_fp} FN={total_fn}\n\n"
        f"Precision: {precision:.2f}\nRecall: {recall:.2f}\n"
    )
    print(f"\nWrote reports to {REPORTS_DIR}/{timestamp}_pr_review.{{json,md}}")


if __name__ == "__main__":
    main()
