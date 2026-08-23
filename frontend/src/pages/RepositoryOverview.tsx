import { useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { wsClient } from "../lib/websocket";
import type { Repository } from "../types";
import type { RepositoryContext } from "../components/layout/RepositoryLayout";
import { Card, CardSoft, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { GitBranch, ExternalLink, MessageSquare, RefreshCw, Loader2 } from "lucide-react";

const NON_TERMINAL_STATUSES = new Set(["PENDING", "CLONING", "PARSING", "CHUNKING", "EMBEDDING", "STORING"]);

const STATUS_LABEL: Record<Repository["status"], string> = {
  PENDING: "Queued",
  CLONING: "Cloning repository...",
  PARSING: "Parsing files...",
  CHUNKING: "Chunking code...",
  EMBEDDING: "Generating embeddings...",
  STORING: "Storing results...",
  INDEXED: "Indexed",
  FAILED: "Failed",
};

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

function OverviewSkeleton() {
  return (
    <div className="space-y-lg animate-pulse">
      <div className="flex items-center gap-md">
        <div className="w-11 h-11 rounded-full bg-canvas-soft border border-hairline shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-canvas-soft rounded-xs" />
          <div className="h-3.5 w-64 bg-canvas-soft rounded-xs" />
        </div>
      </div>
      <div className="h-24 bg-canvas-soft border border-hairline rounded-md" />
    </div>
  );
}

export function RepositoryOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { repository, setRepository, refetchRepository } = useOutletContext<RepositoryContext>();
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState("");

  const handleTriggerIndex = async () => {
    if (!id) return;
    setError("");
    setIsTriggering(true);
    try {
      // POST /repositories/:id/index -> 202 on success, 409
      // ALREADY_INDEXING if a job is already running (the trigger
      // button below is disabled whenever status is non-terminal, so
      // this should rarely be reachable via the UI — but still handled
      // as a recoverable state, not a hard error, since it can happen
      // if two tabs are open).
      await apiFetch(`/repositories/${id}/index`, { method: "POST" });
      wsClient.subscribeToProgress(id);
      const refreshed = await refetchRepository();
      if (refreshed) setRepository(refreshed);
    } catch (e) {
      setError((e as Error).message || "Failed to start indexing");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this repository?")) return;
    try {
      await apiFetch(`/repositories/${id}`, { method: "DELETE" });
      navigate("/repositories");
    } catch (e) {
      console.error(e);
      alert("Failed to delete repository");
    }
  };

  if (!repository) return <OverviewSkeleton />;

  const isIndexing = NON_TERMINAL_STATUSES.has(repository.status);

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-md">
        <div className="flex items-center gap-md min-w-0">
          <div className="w-11 h-11 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center text-ink shrink-0">
            <GithubIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-ink truncate">
              {repository.owner}/{repository.name}
            </h1>
            <a
              href={repository.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-xs text-[13px] text-mute hover:text-link transition-colors"
            >
              {repository.githubUrl}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-sm shrink-0">
          <Badge variant={repository.status === "INDEXED" ? "success" : repository.status === "FAILED" ? "error" : "warning"}>
            {STATUS_LABEL[repository.status]}
          </Badge>
          <Button variant="secondary-sm" onClick={handleTriggerIndex} disabled={isIndexing || isTriggering} className="gap-xs">
            {isIndexing || isTriggering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isTriggering ? "Starting..." : isIndexing ? "Indexing..." : "Re-index"}
          </Button>
        </div>
      </div>

      {error && <p className="text-error-deep text-[14px] bg-error-soft p-sm rounded-xs">{error}</p>}

      <CardSoft className="flex items-center justify-between gap-md flex-wrap">
        <div>
          <p className="text-[13px] font-medium text-mute mb-xxs">Indexing Status</p>
          <p className="text-[15px] font-medium text-ink">{STATUS_LABEL[repository.status]}</p>
        </div>
        <div className="flex items-center gap-lg text-[13px] text-mute font-mono">
          <span className="flex items-center gap-xs">
            <GitBranch className="w-3.5 h-3.5" />
            {repository.defaultBranch}
          </span>
          <span>{repository.filesIndexed} files</span>
          <span>{repository.chunksIndexed} chunks</span>
          {repository.status === "INDEXED" && <span>${Number(repository.embeddingCostUsd).toFixed(4)}</span>}
        </div>
      </CardSoft>

      {repository.status === "INDEXED" && (
        <Button onClick={() => navigate(`/repositories/${id}/chat`)} className="gap-xs">
          <MessageSquare className="w-4 h-4" />
          Ask questions about this repo
        </Button>
      )}

      <Card className="overflow-hidden border-error/40">
        <div className="p-lg">
          <h3 className="text-[16px] font-semibold text-ink mb-xs">Danger Zone</h3>
          <p className="text-[14px] text-mute max-w-[480px] leading-relaxed">
            Deleting this repository will remove all associated index data. This action cannot be undone.
          </p>
        </div>
        <CardFooter className="bg-error/10 border-error/40 flex justify-end">
          <Button variant="danger-sm" onClick={handleDelete}>
            Delete Repository
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
