import { useEffect, useState } from "react";
import { Outlet, Link, useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { wsClient } from "../../lib/websocket";
import type { ProgressMessage, WsErrorMessage } from "../../lib/websocket";
import type { Repository } from "../../types";
import { Badge } from "../ui/badge";

// The Overview/Chat/Pull Requests/Architecture tab list used to live here
// as a local <aside> — it's now rendered by DashboardSidebar as an
// expandable group under "Repositories" in the main nav instead, so this
// layout only owns the shared repository data/header, not sub-navigation.

const STATUS_LABEL: Record<Repository["status"], string> = {
  PENDING: "Queued",
  CLONING: "Cloning...",
  PARSING: "Parsing...",
  CHUNKING: "Chunking...",
  EMBEDDING: "Embedding...",
  STORING: "Storing...",
  INDEXED: "Indexed",
  FAILED: "Failed",
};

// Shared with every child route via <Outlet context> so Overview/Chat/
// Pull Requests all read the same repository row and status instead of
// each re-fetching + re-subscribing to progress independently.
export interface RepositoryContext {
  repository: Repository | null;
  setRepository: (repo: Repository) => void;
  refetchRepository: () => Promise<Repository | null>;
}

export function RepositoryLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repository, setRepository] = useState<Repository | null>(null);

  const fetchRepo = async (): Promise<Repository | null> => {
    const repos = await apiFetch<Repository[]>("/repositories");
    return repos.find((r) => r.id === id) ?? null;
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchRepo().then((repo) => {
      if (cancelled) return;
      if (repo) setRepository(repo);
      else navigate("/repositories");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    wsClient.connect();
    wsClient.subscribeToProgress(id);

    const handleProgress = (payload: unknown) => {
      const msg = payload as ProgressMessage;
      setRepository((prev) =>
        prev ? { ...prev, status: msg.status, filesIndexed: msg.filesIndexed, chunksIndexed: msg.chunksIndexed } : prev
      );
    };
    const handleComplete = () => {
      fetchRepo().then((repo) => repo && setRepository(repo));
    };
    const handleError = (payload: unknown) => {
      console.error("Progress subscription error:", (payload as WsErrorMessage).message);
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

  const context: RepositoryContext = { repository, setRepository, refetchRepository: fetchRepo };

  return (
    <div className="flex flex-col gap-lg h-full min-h-0">
      <div className="flex flex-col gap-xs shrink-0">
        <Link
          to="/repositories"
          className="inline-flex items-center gap-xxs w-fit text-[13px] text-mute hover:text-ink transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Repositories
        </Link>
        <div className="flex items-center gap-sm min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight text-ink truncate">
            {repository ? `${repository.owner}/${repository.name}` : " "}
          </h1>
          {repository && (
            <Badge variant={repository.status === "INDEXED" ? "success" : repository.status === "FAILED" ? "error" : "warning"}>
              {STATUS_LABEL[repository.status]}
            </Badge>
          )}
        </div>
      </div>

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        <Outlet context={context} />
      </main>
    </div>
  );
}
