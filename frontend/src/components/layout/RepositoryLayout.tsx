import { useEffect, useState, type ReactNode } from "react";
import { Outlet, Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { wsClient } from "../../lib/websocket";
import type { ProgressMessage, WsErrorMessage } from "../../lib/websocket";
import type { Repository } from "../../types";
import { Badge } from "../ui/badge";
import { REPO_TABS } from "./DashboardSidebar";
import { cn } from "../../lib/utils";

// The Overview/Chat/Pull Requests/Architecture tab list lives in
// DashboardSidebar for desktop (always visible) and the mobile drawer —
// but below md the sidebar is display:none and the drawer is closed by
// default, so a mobile user had zero visible hint these pages existed
// unless they happened to tap the hamburger. This layout re-renders the
// same REPO_TABS as a persistent horizontal strip, `md:hidden`, so the
// sub-navigation is always visible on mobile without an extra tap —
// desktop is untouched, this never renders there.

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
  // Lets a child route (e.g. RepositoryChat's "New chat" button) render an
  // action into the shared title row instead of a separate row of its own
  // — set on mount, cleared on unmount, so switching tabs doesn't leave a
  // stale action from whichever page set it last.
  setHeaderAction: (action: ReactNode) => void;
}

export function RepositoryLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);

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

  const context: RepositoryContext = { repository, setRepository, refetchRepository: fetchRepo, setHeaderAction };

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm min-w-0">
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
          {headerAction && <div className="shrink-0 flex justify-end">{headerAction}</div>}
        </div>
      </div>

      {id && (
        <div className="md:hidden flex items-center gap-xs overflow-x-auto shrink-0 -mx-1 px-1 pb-xxs">
          {REPO_TABS.map((tab) => {
            const path = `/repositories/${id}${tab.suffix}`;
            const active = location.pathname === path;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                to={path}
                className={cn(
                  "flex items-center gap-xs px-sm py-xs rounded-full text-[13px] font-medium transition-colors shrink-0 whitespace-nowrap border",
                  active
                    ? "bg-canvas-soft text-ink border-hairline-strong"
                    : "text-mute border-hairline hover:text-ink hover:border-hairline-strong"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        <Outlet context={context} />
      </main>
    </div>
  );
}
