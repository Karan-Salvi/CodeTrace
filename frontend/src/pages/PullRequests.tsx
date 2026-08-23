import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import type { PullRequest } from "../types";
import { Badge } from "../components/ui/badge";
import { GitPullRequest, Loader2, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";

export function PullRequests() {
  const { id } = useParams<{ id: string }>();
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollCount = 0;
    // Hard safety net, not just the terminal-status check below: a PR with
    // NO review row at all (`latestReview: null` — never triggered, or a
    // stuck/crashed pr-review worker that never even created one) can't be
    // told apart from "about to start any second" by this page. Without a
    // cap, that case alone keeps `isNonTerminal` true forever and the page
    // polls indefinitely even after every review that WAS running has
    // finished. ~2 minutes at 3s/poll is generous for a real in-flight
    // review, past which continuing to poll isn't buying anything.
    const MAX_POLLS = 40;

    const isNonTerminal = (pr: PullRequest) =>
      !pr.latestReview || pr.latestReview.status === "PENDING" || pr.latestReview.status === "RUNNING";

    const fetchPrs = async () => {
      try {
        const data = await apiFetch<{ pullRequests: PullRequest[] }>(`/repositories/${id}/pull-requests`);
        if (!mounted) return;
        setPrs(data.pullRequests);
        pollCount++;

        // Stop polling once every row has reached a terminal state — a
        // completed/failed review never spontaneously changes again, so
        // continuing to poll would just be wasted requests forever on an
        // otherwise-idle page. Also stop at MAX_POLLS regardless (see
        // comment above) so a permanently-unreviewed or stuck row can't
        // keep this running forever.
        const stillWorking = data.pullRequests.some(isNonTerminal);
        if ((!stillWorking || pollCount >= MAX_POLLS) && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPrs();
    // 3s: fast enough to feel live on a page a user is actively watching,
    // slow enough not to hammer the endpoint while reviews are in flight.
    pollTimer = setInterval(fetchPrs, 3000);

    return () => {
      mounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-mute" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-sm">
        <AlertTriangle className="w-8 h-8 text-error" />
        <p className="text-[14px] text-error-deep">{error}</p>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-md rounded-lg border border-dashed border-hairline bg-canvas-soft">
        <GitPullRequest className="w-12 h-12 text-mute" />
        <div className="text-center">
          <h3 className="text-[16px] font-medium text-ink">No Pull Requests</h3>
          <p className="text-[14px] text-mute">This repository has no reviewed pull requests yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-md">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-ink">Pull Requests</h2>
        <p className="text-[14px] text-mute mt-xxs">Automated code reviews for this repository.</p>
      </div>

      <div className="rounded-md border border-hairline">
        {prs.map((pr, i) => (
          <div
            key={pr.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-sm p-lg ${
              i !== prs.length - 1 ? "border-b border-hairline" : ""
            }`}
          >
            <div className="space-y-xxs min-w-0">
              <div className="flex items-center gap-xs min-w-0">
                <GitPullRequest className="w-4 h-4 text-mute shrink-0" />
                <Link
                  to={pr.latestReview ? `/repositories/${id}/pull-requests/${pr.id}` : "#"}
                  className="font-medium text-[14px] text-ink hover:underline truncate"
                >
                  {pr.title}
                </Link>
                <span className="text-[13px] text-mute shrink-0">#{pr.githubPrNumber}</span>
              </div>
              <div className="flex items-center gap-xs text-[13px] text-mute">
                <span>by {pr.author}</span>
                <span>•</span>
                <span>{new Date(pr.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="shrink-0">
              {pr.latestReview ? (
                <div className="flex items-center gap-sm flex-wrap">
                  {pr.latestReview.status === "PENDING" || pr.latestReview.status === "RUNNING" ? (
                    <Badge variant="warning" className="gap-xxs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {pr.latestReview.status}
                    </Badge>
                  ) : pr.latestReview.status === "FAILED" ? (
                    <Badge variant="error" className="gap-xxs">
                      <AlertCircle className="w-3.5 h-3.5" />
                      FAILED
                    </Badge>
                  ) : pr.latestReview.riskLevel === "HIGH" ? (
                    <Badge variant="error" className="gap-xxs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      High Risk
                    </Badge>
                  ) : pr.latestReview.riskLevel === "MEDIUM" ? (
                    <Badge variant="warning" className="gap-xxs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Medium Risk
                    </Badge>
                  ) : (
                    <Badge variant="success" className="gap-xxs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Low Risk
                    </Badge>
                  )}
                  <Button variant="secondary-sm" asChild>
                    <Link to={`/repositories/${id}/pull-requests/${pr.id}`}>
                      View Review
                    </Link>
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary">No Review</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
