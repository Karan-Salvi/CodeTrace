import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { Badge } from "../components/ui/badge";
import { CardSoft, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import type { PrReview, RiskLevel, PrFinding } from "../types";

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

function groupByCategory(findings: PrFinding[]): Map<PrFinding["category"], PrFinding[]> {
  const grouped = new Map<PrFinding["category"], PrFinding[]>();
  for (const finding of findings) {
    const existing = grouped.get(finding.category) ?? [];
    existing.push(finding);
    grouped.set(finding.category, existing);
  }
  return grouped;
}

export function PullRequestReview() {
  const { id, prId } = useParams();
  const [reviews, setReviews] = useState<PrReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const findings = latest.findings ?? [];
  const grouped = groupByCategory(findings);

  return (
    <div className="flex flex-col gap-4 p-6">
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
            <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
              {latest.riskFactors.map((factor) => (
                <li key={factor.code}>
                  {factor.reason} (+{factor.points})
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[13px] text-muted-foreground">No risk factors triggered.</span>
          )}
        </CardContent>
      </CardSoft>

      {findings.length === 0 ? (
        <div className="text-muted-foreground text-[14px]">No findings for this review.</div>
      ) : (
        CATEGORY_ORDER.filter((category) => grouped.has(category)).map((category) => (
          <CardSoft key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {(grouped.get(category) ?? []).map((finding, i) => (
                  <li key={i} className="flex flex-col gap-1 text-[13px]">
                    <span className="text-foreground font-medium">
                      {finding.file}:{finding.line}
                    </span>
                    <span className="text-muted-foreground">{finding.explanation}</span>
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
