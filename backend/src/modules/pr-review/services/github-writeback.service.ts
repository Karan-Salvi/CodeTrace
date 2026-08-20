import { GITHUB_API_BASE } from "../../repositories/services/github-app.service.js";
import type { PrFinding, RiskFactor } from "../types/pr-review.types.js";

export interface ReviewForWriteback {
  riskScore: number | null;
  riskLevel: string | null;
  riskFactors: RiskFactor[];
  findings: PrFinding[];
}

interface GitHubReviewComment {
  path: string;
  position: number;
  body: string;
}

function buildSummaryBody(
  review: ReviewForWriteback,
  stillWorthMentioning: PrFinding[]
): string {
  const lines: string[] = [
    `**CodeTrace Review — Risk: ${review.riskLevel ?? "UNKNOWN"} (${review.riskScore ?? 0}/100)**`,
    "",
  ];

  if (review.riskFactors.length > 0) {
    lines.push("Risk factors:");
    for (const f of review.riskFactors) {
      lines.push(`- ${f.reason} (+${f.points})`);
    }
    lines.push("");
  }

  if (stillWorthMentioning.length > 0) {
    lines.push("Additional findings (outside the changed diff, could not be inline-anchored):");
    for (const finding of stillWorthMentioning) {
      lines.push(`- **${finding.category}** \`${finding.file}:${finding.line}\`: ${finding.explanation}`);
    }
  }

  return lines.join("\n");
}

// Single write-back pipeline with per-finding routing: a finding with a
// citation whose line has a known GitHub diff `position` becomes an
// inline review comment; everything else (no citation, or a citation
// outside the diff's visible hunks — e.g. a one-hop dependency chunk)
// goes into the summary body instead. No finding is ever silently
// dropped, and exactly one GitHub review is posted per call.
export async function postReviewToGitHub(
  installationToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  review: ReviewForWriteback,
  positionByFileAndLine: Map<string, Map<number, number>>
): Promise<{ posted: boolean; error?: string }> {
  const comments: GitHubReviewComment[] = [];
  const stillWorthMentioning: PrFinding[] = [];

  for (const finding of review.findings) {
    const citation = finding.citation;
    // Anchor on finding.line (the actual flagged line), not
    // citation.startLine (the retrieved chunk's boundary, often far from
    // the specific line the finding is about). But finding.line is a
    // separate, LLM-emitted field never checked against the citation —
    // validateCitation only validates the citation chunk itself. Without
    // the file-match and bounds checks below, a finding whose citation
    // legitimately points at a one-hop dependency in a DIFFERENT file
    // could get its comment posted on that other file, at whatever line
    // finding.line happens to be — wrong file, wrong content, still
    // "successfully" anchored because a position existed for that
    // (file, line) pair. Only anchor when the citation is actually the
    // file the finding is about, and finding.line genuinely falls inside
    // the citation's validated range.
    const inCitationFile = citation && finding.file === citation.file;
    const inCitationRange =
      citation && finding.line >= citation.startLine && finding.line <= citation.endLine;
    const position =
      citation && inCitationFile && inCitationRange
        ? positionByFileAndLine.get(citation.file)?.get(finding.line)
        : undefined;

    if (citation && position !== undefined) {
      comments.push({
        path: citation.file,
        position,
        body: `**${finding.category}**: ${finding.explanation}`,
      });
    } else {
      stillWorthMentioning.push(finding);
    }
  }

  const body = buildSummaryBody(review, stillWorthMentioning);

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${installationToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    // event: "COMMENT" only — this is advisory review, never a merge gate
    // (REQUEST_CHANGES/APPROVE are deliberately never used).
    body: JSON.stringify({ event: "COMMENT", body, comments }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    return {
      posted: false,
      error: `status ${res.status}: ${(errBody as { message?: string }).message ?? "unknown error"}`,
    };
  }

  return { posted: true };
}
