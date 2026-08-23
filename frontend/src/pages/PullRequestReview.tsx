import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { wsClient } from "../lib/websocket";
import { Badge } from "../components/ui/badge";
import { CardSoft, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { MonacoDiffViewer } from "../components/ui/MonacoDiffViewer";
import type { PrReview, RiskLevel, PrFinding, PrDiffContent } from "../types";

const RISK_BADGE_VARIANT: Record<RiskLevel, "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
};

const CATEGORY_ORDER: PrFinding["category"][] = [
  "SECURITY",
  "BUG",
  "PERFORMANCE",
  "LOGIC",
  "TESTING",
  "MAINTAINABILITY",
];

interface IndexedFinding {
  finding: PrFinding;
  index: number;
}

// Keyed by each finding's index in the original flat `findings` array, not
// a per-category-local index — two different categories' first findings
// would otherwise both be "index 0", making expandedIndex/diffCache collide
// across categories (expanding one would show as expanded for both, and
// the wrong file's diff would be served from the shared cache slot).
function groupByCategory(findings: PrFinding[]): Map<PrFinding["category"], IndexedFinding[]> {
  const grouped = new Map<PrFinding["category"], IndexedFinding[]>();
  findings.forEach((finding, index) => {
    const existing = grouped.get(finding.category) ?? [];
    existing.push({ finding, index });
    grouped.set(finding.category, existing);
  });
  return grouped;
}

export function PullRequestReview() {
  const { id, prId } = useParams();
  const [reviews, setReviews] = useState<PrReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [diffCache, setDiffCache] = useState<Record<number, PrDiffContent>>({});
  const [diffLoadingIndex, setDiffLoadingIndex] = useState<number | null>(null);
  const [diffErrors, setDiffErrors] = useState<Record<number, string>>({});

  async function toggleDiff(index: number, finding: PrFinding) {
    if (expandedIndex === index) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(index);
    if (diffCache[index]) return;

    setDiffLoadingIndex(index);
    try {
      const data = await apiFetch<PrDiffContent>(
        `/repositories/${id}/pull-requests/${prId}/diff?file=${encodeURIComponent(finding.file)}`
      );
      setDiffCache((prev) => ({ ...prev, [index]: data }));
    } catch (e) {
      setDiffErrors((prev) => ({
        ...prev,
        [index]: e instanceof Error ? e.message : "Failed to load diff",
      }));
    } finally {
      setDiffLoadingIndex(null);
    }
  }

  useEffect(() => {
    if (!id || !prId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<PrReview[]>(`/repositories/${id}/pull-requests/${prId}/reviews`);
        if (!cancelled) setReviews(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load review");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, prId]);

  useEffect(() => {
    if (!id || !prId) return;

    wsClient.connect();
    wsClient.subscribeToPrReviewProgress(prId);

    // Re-fetches the full review on every live update rather than patching
    // state in place — the lightweight progress message only carries
    // status/riskScore/riskLevel, not findings/riskFactors/failureReason,
    // and this page is low-traffic enough that a full re-fetch per change
    // is simpler and just as fast as merging partial state.
    const refetch = () => {
      apiFetch<PrReview[]>(`/repositories/${id}/pull-requests/${prId}/reviews`)
        .then((data) => setReviews(data))
        .catch(() => {
          // A transient refetch failure here just means the next progress
          // tick (500ms later) will try again — not worth surfacing as a
          // page-level error on top of the initial load's own error state.
        });
    };

    wsClient.on("pr-review-progress", refetch);
    wsClient.on("pr-review-progress-complete", refetch);

    return () => {
      wsClient.off("pr-review-progress", refetch);
      wsClient.off("pr-review-progress-complete", refetch);
    };
  }, [id, prId]);

  if (loading) {
    return <div className="text-body text-[14px] px-md py-lg">Loading review...</div>;
  }

  if (error) {
    return <div className="text-error-deep text-[14px] px-md py-lg">{error}</div>;
  }

  const latest = reviews[0];

  if (!latest) {
    return (
      <div className="text-body text-[14px] px-md py-lg">
        No review yet for this pull request.
      </div>
    );
  }

  // A FAILED review has null riskScore/findings — without this check it
  // renders identically to a genuinely clean COMPLETE review with zero
  // findings, giving no signal that the pipeline actually errored out.
  if (latest.status === "FAILED") {
    return (
      <div className="flex flex-col gap-4 p-6">
        <CardSoft>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Review Failed
              <Badge variant="error">FAILED</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-[13px] text-error-deep">
              {latest.failureReason ?? "The review pipeline failed for an unknown reason."}
            </span>
          </CardContent>
        </CardSoft>
      </div>
    );
  }
  if (latest.status === "PENDING" || latest.status === "RUNNING") {
    return (
      <div className="text-body text-[14px] px-md py-lg">
        Review in progress ({latest.status.toLowerCase()})...
      </div>
    );
  }

  const findings = latest.findings ?? [];
  const grouped = groupByCategory(findings);

  return (
    <div className="flex flex-col gap-4 p-6">
      {latest.writebackFailedAt && (
        <div className="text-[13px] text-warning-deep bg-warning-soft rounded-sm px-md py-sm">
          This review completed successfully, but posting it back to GitHub failed — it isn't visible
          on the pull request itself. The results below are accurate and saved.
        </div>
      )}
      <CardSoft>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Risk
            {latest.riskLevel && (
              <Badge variant={RISK_BADGE_VARIANT[latest.riskLevel]}>
                {latest.riskLevel} ({latest.riskScore}/100)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latest.riskFactors && latest.riskFactors.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[13px] text-mute">
              {latest.riskFactors.map((factor) => (
                <li key={factor.code}>
                  {factor.reason} (+{factor.points})
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[13px] text-mute">No risk factors triggered.</span>
          )}
        </CardContent>
      </CardSoft>

      {findings.length === 0 ? (
        <div className="text-mute text-[14px]">No findings for this review.</div>
      ) : (
        CATEGORY_ORDER.filter((category) => grouped.has(category)).map((category) => (
          <CardSoft key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {(grouped.get(category) ?? []).map(({ finding, index }) => (
                  <li key={index} className="flex flex-col gap-xs text-[13px]">
                    <div className="flex items-center justify-between gap-sm">
                      <span className="text-ink font-medium">
                        {finding.file}:{finding.line}
                      </span>
                      <Button variant="secondary-sm" onClick={() => toggleDiff(index, finding)}>
                        {expandedIndex === index ? "Hide diff" : "View diff"}
                      </Button>
                    </div>
                    <span className="text-mute">{finding.explanation}</span>
                    {expandedIndex === index && (
                      <div className="mt-xs">
                        {diffLoadingIndex === index ? (
                          <div className="text-mute text-[12px] py-sm">Loading diff...</div>
                        ) : diffErrors[index] ? (
                          <div className="text-error-deep text-[12px] py-sm">{diffErrors[index]}</div>
                        ) : diffCache[index]?.previewUnavailable ? (
                          <div className="text-mute text-[12px] py-sm">
                            Diff preview unavailable for this file.
                          </div>
                        ) : diffCache[index] ? (
                          <MonacoDiffViewer
                            line={finding.line}
                            original={diffCache[index].original ?? ""}
                            modified={diffCache[index].modified ?? ""}
                            language={diffCache[index].language ?? "plaintext"}
                          />
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </CardSoft>
        ))
      )}
    </div>
  );
}
