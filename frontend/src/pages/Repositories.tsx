import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import type { Repository, RepositoryStatus } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CardSoft } from "../components/ui/card";
import { EmptyState, EmptyStateTitle, EmptyStateDescription, EmptyStateIcon } from "../components/ui/empty-state";
import {
  FolderGit2,
  Search,
  Plus,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// lucide-react has no "Github" glyph (removed upstream) — same fallback
// GithubIcon used in Landing.tsx.
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

const IN_PROGRESS_STATUSES: RepositoryStatus[] = ["PENDING", "CLONING", "PARSING", "CHUNKING", "EMBEDDING", "STORING"];

function statusMeta(status: RepositoryStatus) {
  if (status === "INDEXED") {
    return { icon: CheckCircle2, className: "text-success", label: "Indexed" };
  }
  if (status === "FAILED") {
    return { icon: AlertCircle, className: "text-error", label: "Failed" };
  }
  return { icon: Loader2, className: "text-warning animate-spin", label: "Indexing" };
}

function RepositoryCardSkeleton() {
  return (
    <div className="bg-canvas-soft border border-hairline rounded-lg p-lg animate-pulse">
      <div className="flex items-center gap-sm mb-lg">
        <div className="w-9 h-9 rounded-full bg-canvas border border-hairline" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 bg-canvas rounded-xs" />
          <div className="h-3 w-1/3 bg-canvas rounded-xs" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-canvas rounded-xs" />
        <div className="h-3 w-3/4 bg-canvas rounded-xs" />
      </div>
    </div>
  );
}

export function Repositories() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    apiFetch<Repository[]>("/repositories")
      .then((data) => {
        if (mounted) setRepositories(data || []);
      })
      .catch((e: unknown) => console.error(e))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter(
      (repo) => repo.name.toLowerCase().includes(q) || repo.owner.toLowerCase().includes(q)
    );
  }, [repositories, query]);

  const summary = useMemo(
    () => ({
      total: repositories.length,
      indexed: repositories.filter((r) => r.status === "INDEXED").length,
      inProgress: repositories.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)).length,
      failed: repositories.filter((r) => r.status === "FAILED").length,
    }),
    [repositories]
  );

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Repositories</h1>
          <p className="text-[14px] text-mute mt-xxs">Syntax-level indexing and PR review across your connected repos.</p>
        </div>
        <Button variant="secondary-sm" onClick={() => navigate("/repositories/new")} className="gap-xs shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Connect Repository
        </Button>
      </div>

      {!loading && repositories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
          {[
            { label: "Total", value: summary.total },
            { label: "Indexed", value: summary.indexed },
            { label: "In progress", value: summary.inProgress },
            { label: "Failed", value: summary.failed },
          ].map((stat) => (
            <CardSoft key={stat.label} className="p-md">
              <p className="text-[12px] text-mute mb-xxs">{stat.label}</p>
              <p className="text-[22px] font-semibold text-ink font-mono">{stat.value}</p>
            </CardSoft>
          ))}
        </div>
      )}

      {!loading && repositories.length > 0 && (
        <div className="relative w-full sm:max-w-90">
          <Search className="absolute left-sm top-1/2 -translate-y-1/2 w-4 h-4 text-mute pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories..."
            className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {Array.from({ length: 4 }, (_, i) => (
            <RepositoryCardSkeleton key={i} />
          ))}
        </div>
      ) : repositories.length === 0 ? (
        <EmptyState className="border border-hairline bg-canvas">
          <EmptyStateIcon>
            <FolderGit2 className="w-8 h-8 text-mute" />
          </EmptyStateIcon>
          <EmptyStateTitle>No repositories connected</EmptyStateTitle>
          <EmptyStateDescription>
            Connect a GitHub repository to start indexing, asking questions, and reviewing pull requests.
          </EmptyStateDescription>
          <Button onClick={() => navigate("/repositories/new")} variant="secondary" className="h-[32px] text-[13px]">
            Connect Repository
          </Button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState className="border border-hairline bg-canvas">
          <EmptyStateIcon>
            <Search className="w-8 h-8 text-mute" />
          </EmptyStateIcon>
          <EmptyStateTitle>No matches</EmptyStateTitle>
          <EmptyStateDescription>No repository matches "{query}".</EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {filtered.map((repo) => {
            const { icon: StatusIcon, className: statusClassName, label: statusLabel } = statusMeta(repo.status);
            return (
              <Link key={repo.id} to={`/repositories/${repo.id}`} className="block focus:outline-none group">
                <div className="bg-canvas-soft border border-hairline rounded-lg p-lg hover:border-hairline-strong transition-colors h-full">
                  <div className="flex items-start justify-between mb-md">
                    <div className="flex items-center gap-sm min-w-0">
                      <div className="w-9 h-9 rounded-full bg-canvas border border-hairline flex items-center justify-center text-ink group-hover:text-link transition-colors shrink-0">
                        <GithubIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[15px] tracking-tight text-ink group-hover:text-link transition-colors truncate">
                          {repo.name}
                        </h3>
                        <p className="text-[12px] text-mute truncate">{repo.owner}/{repo.name}</p>
                      </div>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full border border-hairline flex items-center justify-center shrink-0"
                      title={statusLabel}
                      aria-label={statusLabel}
                    >
                      <StatusIcon className={`w-3.5 h-3.5 ${statusClassName}`} />
                    </div>
                  </div>

                  <div className="flex items-center gap-xs text-[13px] text-mute">
                    <GitBranch className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono text-[11px] bg-canvas border border-hairline px-xs rounded-xs">
                      {repo.defaultBranch}
                    </span>
                    <span>{repo.chunksIndexed.toLocaleString()} chunks indexed</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
