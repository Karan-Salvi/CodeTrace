import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { LayoutDashboard, MessageSquare, GitPullRequest, ChevronLeft } from "lucide-react";
import { cn } from "../../lib/utils";
import { apiFetch } from "../../lib/api-client";
import { wsClient } from "../../lib/websocket";
import type { ProgressMessage, WsErrorMessage } from "../../lib/websocket";
import type { Repository } from "../../types";
import { Badge } from "../ui/badge";

const TABS = [
  { label: "Overview", icon: LayoutDashboard, suffix: "" },
  { label: "Chat", icon: MessageSquare, suffix: "/chat" },
  { label: "Pull Requests", icon: GitPullRequest, suffix: "/pull-requests" },
];

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
  const location = useLocation();
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
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-xs">
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

      <div className="flex flex-col md:flex-row w-full gap-lg">
        <aside className="w-full md:w-56 flex-shrink-0 flex flex-row md:flex-col gap-xs md:pr-lg md:border-r md:border-hairline">
          {TABS.map((tab) => {
            const path = `/repositories/${id}${tab.suffix}`;
            const active = location.pathname === path;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                to={path}
                className={cn(
                  "flex items-center gap-xs rounded-sm px-sm py-xs text-[14px] font-medium transition-colors",
                  active ? "bg-canvas-soft text-ink" : "text-mute hover:text-ink hover:bg-canvas-soft/50"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-ink" : "text-mute")} />
                {tab.label}
              </Link>
            );
          })}
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}
