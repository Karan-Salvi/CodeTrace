import type { RankedChunk } from "../types/retrieval.types.js";

const IDENTIFIER_PATTERN = /[a-z]+[A-Z]|[a-z]+_[a-z]/;

export function classifyQuery(queryText: string): "identifier" | "semantic" {
  return IDENTIFIER_PATTERN.test(queryText) ? "identifier" : "semantic";
}

interface MergeOptions {
  queryType: "identifier" | "semantic";
}

// retrieval.md: both paths always run; classification reweights the RRF
// constant per path rather than skipping a path, so a misclassification
// degrades ranking instead of dropping results entirely.
export function mergeRankings(
  vectorResults: RankedChunk[],
  keywordResults: RankedChunk[],
  opts: MergeOptions
): RankedChunk[] {
  const vectorK = opts.queryType === "identifier" ? 80 : 40;
  const keywordK = opts.queryType === "identifier" ? 10 : 40;

  const scores = new Map<string, number>();

  for (const r of vectorResults) {
    scores.set(r.chunkId, (scores.get(r.chunkId) ?? 0) + 1 / (vectorK + r.rank));
  }
  for (const r of keywordResults) {
    scores.set(r.chunkId, (scores.get(r.chunkId) ?? 0) + 1 / (keywordK + r.rank));
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chunkId], index) => ({ chunkId, rank: index + 1 }));
}
