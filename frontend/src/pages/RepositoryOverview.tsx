import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { wsClient } from "../lib/websocket";
import type { ProgressMessage, WsErrorMessage } from "../lib/websocket";
import type { Repository } from "../types";
import { CardSoft, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

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

export function RepositoryOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState("");

  // No GET /repositories/:id endpoint exists — only GET /repositories
  // (list) and DELETE /repositories/:id. Fetch the list and find this
  // repo by id. Returns the found repo (or null) so callers outside an
  // effect (handleTriggerIndex, the progress-complete handler) can
  // await + use the result directly instead of relying on a state
  // update to have landed yet.
  const fetchRepo = async (): Promise<Repository | null> => {
    const repos = await apiFetch<Repository[]>("/repositories");
    return repos.find((r) => r.id === id) ?? null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = await fetchRepo();
        if (cancelled) return;
        if (repo) {
          setRepository(repo);
        } else {
          navigate("/repositories");
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;

    wsClient.connect();
    wsClient.subscribeToProgress(id);

    const handleProgress = (payload: unknown) => {
      const msg = payload as ProgressMessage;
      setRepository((prev) =>
        prev ? { ...prev, status: msg.status, filesIndexed: msg.filesIndexed, chunksIndexed: msg.chunksIndexed } : null
      );
    };

    const handleComplete = () => {
      // Re-fetch so embeddingCostUsd and any other server-computed
      // fields the progress message doesn't carry are up to date once
      // indexing actually finishes.
      fetchRepo().then((repo) => {
        if (repo) setRepository(repo);
      });
    };

    const handleError = (payload: unknown) => {
      const msg = payload as WsErrorMessage;
      console.error("Progress subscription error:", msg.message);
    };

    wsClient.on("progress", handleProgress);
    wsClient.on("progress-complete", handleComplete);
    wsClient.on("error", handleError);

    return () => {
      wsClient.off("progress", handleProgress);
      wsClient.off("progress-complete", handleComplete);
      wsClient.off("error", handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  if (loading || !repository) return <div>Loading...</div>;

  const isIndexing = NON_TERMINAL_STATUSES.has(repository.status);

  return (
    <div className="space-y-xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display-md tracking-[-0.96px] text-ink font-semibold mb-xs">
            {repository.owner}/{repository.name}
          </h1>
          <a
            href={repository.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-link hover:underline text-[14px]"
          >
            {repository.githubUrl}
          </a>
        </div>
        <div className="flex items-center gap-sm">
          <Badge variant={repository.status === "INDEXED" ? "success" : repository.status === "FAILED" ? "error" : "warning"}>
            {STATUS_LABEL[repository.status]}
          </Badge>
          <Button variant="secondary-sm" onClick={handleTriggerIndex} disabled={isIndexing || isTriggering}>
            {isTriggering ? "Starting..." : isIndexing ? "Indexing..." : "Re-index"}
          </Button>
        </div>
      </div>

      {error && <p className="text-error text-[14px] bg-error-soft p-sm rounded-xs">{error}</p>}

      <CardSoft>
        <CardHeader>
          <CardTitle>Indexing Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body text-[14px]">{STATUS_LABEL[repository.status]}</p>
          {isIndexing && (
            <p className="text-[12px] text-mute font-mono mt-xs">
              {repository.filesIndexed} files, {repository.chunksIndexed} chunks so far
            </p>
          )}
          {repository.status === "INDEXED" && (
            <p className="text-[12px] text-mute font-mono mt-xs">
              {repository.filesIndexed} files, {repository.chunksIndexed} chunks — $
              {Number(repository.embeddingCostUsd).toFixed(4)} embedding cost
            </p>
          )}
        </CardContent>
      </CardSoft>

      {repository.status === "INDEXED" && (
        <Button onClick={() => navigate(`/repositories/${id}/chat`)}>Ask questions about this repo</Button>
      )}

      <div className="pt-xl border-t border-hairline mt-2xl">
        <h3 className="text-[16px] font-medium text-ink mb-sm">Danger Zone</h3>
        <p className="text-body text-[14px] mb-md">
          Deleting this repository will remove all associated index data. This action cannot be undone.
        </p>
        <Button className="bg-error hover:bg-error-deep text-white border-transparent" onClick={handleDelete}>
          Delete Repository
        </Button>
      </div>
    </div>
  );
}
