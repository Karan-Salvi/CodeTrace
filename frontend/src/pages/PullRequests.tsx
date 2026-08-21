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
    const fetchPrs = async () => {
      try {
        const data = await apiFetch<{ pullRequests: PullRequest[] }>(`/repositories/${id}/pull-requests`);
        if (mounted) setPrs(data.pullRequests);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchPrs();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50">
        <GitPullRequest className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">No Pull Requests</h3>
          <p className="text-sm text-muted-foreground">This repository has no reviewed pull requests yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pull Requests</h2>
        <p className="text-muted-foreground">Automated code reviews for this repository.</p>
      </div>

      <div className="rounded-md border">
        {prs.map((pr, i) => (
          <div
            key={pr.id}
            className={`flex items-center justify-between p-4 ${
              i !== prs.length - 1 ? "border-b" : ""
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                <Link
                  to={pr.latestReview ? `/repositories/${id}/pull-requests/${pr.id}` : "#"}
                  className="font-medium hover:underline"
                >
                  {pr.title}
                </Link>
                <span className="text-sm text-muted-foreground">#{pr.githubPrNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>by {pr.author}</span>
                <span>•</span>
                <span>{new Date(pr.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div>
              {pr.latestReview ? (
                <div className="flex items-center gap-3">
                  {pr.latestReview.status === "PENDING" || pr.latestReview.status === "RUNNING" ? (
                    <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {pr.latestReview.status}
                    </Badge>
                  ) : pr.latestReview.status === "FAILED" ? (
                    <Badge variant="error" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      FAILED
                    </Badge>
                  ) : pr.latestReview.riskLevel === "HIGH" ? (
                    <Badge variant="error" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      High Risk
                    </Badge>
                  ) : pr.latestReview.riskLevel === "MEDIUM" ? (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Medium Risk
                    </Badge>
                  ) : (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
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
