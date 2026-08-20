import { GITHUB_API_BASE } from "../../repositories/services/github-app.service.js";
import type { ChangedLineRange, ParsedDiff, PrDiffFile, PrDiffResult } from "../types/pr-review.types.js";

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

// GitHub's compare API returns one `patch` string per file — raw unified-
// diff hunks only, no `diff --git` header. Two responsibilities:
// 1. One ChangedLineRange per hunk, from the hunk header's new-file
//    start/length directly (matches diff-analyzer.service.ts's existing
//    "any chunk whose range overlaps the diff" semantics).
// 2. A new-file-line -> GitHub review-comment `position` map. Per
//    GitHub's documented (deprecated but still required) Reviews API
//    `position` field: "the line just below the first '@@' line is
//    position 1, the next line is position 2," continuing through
//    every subsequent line — including later hunk headers — without
//    resetting. Since GitHub's patch text always starts with a hunk
//    header, position for lines[i] is simply i (0-indexed array
//    position), valid for i >= 1.
export function parseUnifiedDiff(filePath: string, patch: string): ParsedDiff {
  const lines = patch.split("\n");
  const ranges: ChangedLineRange[] = [];
  const positionByNewLine = new Map<number, number>();

  let currentNewLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = HUNK_HEADER_RE.exec(line);

    if (headerMatch) {
      const newStart = parseInt(headerMatch[3], 10);
      const newLines = headerMatch[4] !== undefined ? parseInt(headerMatch[4], 10) : 1;
      if (newLines > 0) {
        ranges.push({ filePath, startLine: newStart, endLine: newStart + newLines - 1 });
      }
      currentNewLine = newStart;
      continue;
    }

    const position = i; // lines[0] is always the first hunk header

    if (line.startsWith("-")) {
      // Deletion: no line in the new file, no position entry.
      continue;
    }

    if (line.startsWith("\\")) {
      // "\ No newline at end of file" marker — not a real content line.
      // Doesn't start with "-", so without this check it fell into the
      // addition/context branch below: consumed a currentNewLine that
      // doesn't exist and shifted every subsequent line number in this
      // hunk off by one.
      continue;
    }

    if (line.length === 0) {
      // A real diff content line always starts with one of " "/"+"/"-" —
      // a truly empty element can only be an artifact of patch.split("\n")
      // on a trailing newline (or a caller/proxy that appends one), never
      // legitimate diff content. Same corruption risk as the marker line
      // above if treated as real content.
      continue;
    }

    // Addition ("+") or context (" ") line: present in the new file at
    // currentNewLine, and addressable by this position.
    positionByNewLine.set(currentNewLine, position);
    currentNewLine++;
  }

  return { ranges, positionByNewLine };
}

async function fetchCompareFiles(
  installationToken: string,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string
): Promise<PrDiffFile[]> {
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`, {
    headers: {
      Authorization: `Bearer ${installationToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to fetch PR diff (status ${res.status}): ${(body as { message?: string }).message ?? "unknown error"}`
    );
  }

  const body = (await res.json()) as {
    files?: Array<{ filename: string; status: string; patch?: string }>;
  };

  return (body.files ?? []).map((f) => ({
    path: f.filename,
    status: f.status as PrDiffFile["status"],
    patch: f.patch ?? null,
  }));
}

// The single entry point Task 8's consumer calls: fetch the real diff
// between a PR's base and head commit, and assemble it into exactly what
// runPrReview() and the write-back step need. Removed files and
// binary/too-large files (GitHub omits `patch` for those) are excluded —
// there's nothing in the new tree to chunk-map for a removed file, and no
// patch to parse for a binary one.
export async function getPrDiff(
  installationToken: string,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string
): Promise<PrDiffResult> {
  const files = await fetchCompareFiles(installationToken, owner, repo, baseSha, headSha);

  const changedRanges: ChangedLineRange[] = [];
  const positionByFileAndLine = new Map<string, Map<number, number>>();

  for (const file of files) {
    if (file.status === "removed" || !file.patch) continue;
    const parsed: ParsedDiff = parseUnifiedDiff(file.path, file.patch);
    changedRanges.push(...parsed.ranges);
    positionByFileAndLine.set(file.path, parsed.positionByNewLine);
  }

  return { changedRanges, positionByFileAndLine };
}
