import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import type { Repository } from "../types";
import { Button } from "../components/ui/button";
import { EmptyState, EmptyStateTitle, EmptyStateDescription, EmptyStateIcon } from "../components/ui/empty-state";
import { FolderGit2 } from "lucide-react";

export function Repositories() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const reposData = await apiFetch<Repository[]>("/repositories");
      setRepositories(reposData || []);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, []);

  if (loading) return <div className="p-xl">Loading...</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-mute">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            placeholder="Search Projects"
            className="w-full bg-canvas border border-hairline rounded-md pl-10 pr-4 py-2 text-[14px] text-ink placeholder:text-mute focus:outline-none focus:border-mute transition-colors h-[40px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Usage Widget */}
          <div className="bg-canvas border border-hairline rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[14px] text-ink">Usage</h3>
            </div>
            <div className="bg-canvas-soft border border-hairline rounded-md p-3 mb-4 flex items-center justify-between">
              <span className="text-[13px] font-medium">Last 30 days</span>
              <button className="text-[12px] bg-canvas border border-hairline px-2 py-1 rounded hover:bg-canvas-soft transition-colors font-medium">Upgrade</button>
            </div>
            <div className="space-y-3">
              {[
                { name: "Fluid Active CPU", val: "18m 12s / 4h" },
                { name: "Fast Origin Transfer", val: "396.11 MB / 10 GB" },
                { name: "Microfrontends Routing", val: "0 / 50K" },
                { name: "Edge Function Execution Units", val: "0 / 500K" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full border border-hairline"></div>
                    <span className="text-mute">{item.name}</span>
                  </div>
                  <span className="font-mono text-[12px] text-ink">{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Widget */}
          <div className="bg-canvas border border-hairline rounded-lg p-4">
            <h3 className="font-semibold text-[14px] text-ink mb-6">Alerts</h3>
            <div className="text-center py-4">
              <p className="text-[14px] font-medium text-ink mb-1">Get alerted for anomalies</p>
              <p className="text-[13px] text-mute mb-4 px-4">Automatically monitor your projects for anomalies and get notified.</p>
              <button className="text-[13px] bg-canvas border border-hairline px-4 py-1.5 rounded-md hover:bg-canvas-soft transition-colors font-medium">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Projects */}
        <div className="lg:col-span-8">
          <div className="mb-4">
            <h3 className="font-semibold text-[14px] text-ink">Projects</h3>
          </div>

          {repositories.length === 0 ? (
            <EmptyState className="border border-hairline bg-canvas">
              <EmptyStateIcon>
                <FolderGit2 className="w-8 h-8 text-mute" />
              </EmptyStateIcon>
              <EmptyStateTitle>No projects connected</EmptyStateTitle>
              <EmptyStateDescription>
                Connect a GitHub repository to start tracking.
              </EmptyStateDescription>
              <Button onClick={() => navigate("/repositories/new")} variant="secondary" className="h-[32px] text-[13px]">Connect Repository</Button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repositories.map((repo) => (
                <Link key={repo.id} to={`/repositories/${repo.id}`} className="block focus:outline-none">
                  <div className="bg-canvas-soft border border-hairline rounded-lg p-4 hover:border-mute transition-colors cursor-pointer group h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-canvas border border-hairline flex items-center justify-center text-ink group-hover:text-link transition-colors overflow-hidden">
                           <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-[15px] tracking-tight text-ink group-hover:text-link transition-colors">
                            {repo.name}
                          </h3>
                          <p className="text-[12px] text-mute">{repo.name.toLowerCase()}.vercel.app</p>
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full border border-hairline flex items-center justify-center text-mute">
                        {repo.status === "INDEXED" ? (
                          <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : repo.status === "FAILED" ? (
                          <svg className="w-3.5 h-3.5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-warning animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[13px] text-mute truncate">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        <span className="truncate"><span className="font-mono text-[11px] mr-1 bg-canvas border border-hairline px-1 rounded">{repo.defaultBranch}</span> tracked repository</span>
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-mute truncate">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                        <span className="truncate">{repo.owner}/{repo.name} · recently</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
