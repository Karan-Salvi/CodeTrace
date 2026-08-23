# evaluation/runner/retrieval_eval.py
#
# Calls the real, already-tested backend evaluation endpoint
# (POST /evaluation/retrieval-run) once per retrieval config and reports
# the real numbers it returns. No metric math is duplicated here.
#
# Usage:
#   python evaluation/runner/retrieval_eval.py                # all 4 configs
#   python evaluation/runner/retrieval_eval.py --config hybrid # one config

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "metrics"))
from recall_precision_mrr import format_retrieval_table  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURE_MANIFEST_PATH = REPO_ROOT / "evaluation" / ".eval-fixture.json"
REPORTS_DIR = REPO_ROOT / "evaluation" / "reports"

CONFIG_ARG_TO_API = {
    "vector": "VECTOR_ONLY",
    "keyword": "KEYWORD_ONLY",
    "hybrid": "HYBRID",
    "hybrid-rerank": "HYBRID_RERANKED",
}
API_TO_LABEL = {
    "VECTOR_ONLY": "Vector",
    "KEYWORD_ONLY": "Keyword",
    "HYBRID": "Hybrid",
    "HYBRID_RERANKED": "Hybrid+Rerank",
}


def load_fixture_manifest() -> dict:
    if not FIXTURE_MANIFEST_PATH.exists():
        raise SystemExit(
            f"{FIXTURE_MANIFEST_PATH} not found — run "
            "`npm run seed:eval-fixture` (from backend/) first."
        )
    return json.loads(FIXTURE_MANIFEST_PATH.read_text())


def run_config(base_url: str, token: str, repository_id: str, api_config: str) -> dict:
    resp = requests.post(
        f"{base_url}/evaluation/retrieval-run",
        headers={"Authorization": f"Bearer {token}"},
        json={"repositoryId": repository_id, "config": api_config},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    return {"recall_at_5": data["recallAt5"], "precision_at_5": data["precisionAt5"], "mrr": data["mrr"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", choices=list(CONFIG_ARG_TO_API.keys()), default=None)
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    fixture = load_fixture_manifest()
    configs_to_run = [args.config] if args.config else list(CONFIG_ARG_TO_API.keys())

    results: dict[str, dict[str, float]] = {}
    for config_arg in configs_to_run:
        api_config = CONFIG_ARG_TO_API[config_arg]
        print(f"Running {api_config}...")
        results[API_TO_LABEL[api_config]] = run_config(
            args.base_url, fixture["token"], fixture["repositoryId"], api_config
        )

    table = format_retrieval_table(results)
    print("\n" + table)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    (REPORTS_DIR / f"{timestamp}_retrieval.json").write_text(json.dumps(results, indent=2))
    (REPORTS_DIR / f"{timestamp}_retrieval.md").write_text(f"# Retrieval Evaluation — {timestamp}\n\n```\n{table}\n```\n")
    print(f"\nWrote reports to {REPORTS_DIR}/{timestamp}_retrieval.{{json,md}}")


if __name__ == "__main__":
    main()
