import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import type { Repository, RepositoryInstallation } from "../types";
import { CardSoft } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { EmptyState, EmptyStateTitle, EmptyStateDescription, EmptyStateIcon } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Plus, FolderGit2 } from "lucide-react";

export function Repositories() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [installations, setInstallations] = useState<RepositoryInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Form state
  const [installationId, setInstallationId] = useState("");
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [reposData, instData] = await Promise.all([
        apiFetch<Repository[]>("/repositories"),
        apiFetch<RepositoryInstallation[]>("/repositories/installations")
      ]);
      setRepositories(reposData || []);
      setInstallations(instData || []);
      if (instData && instData.length > 0) {
        setInstallationId(instData[0].id);
      }
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

  const handleInstallClick = async () => {
    try {
      setIsInstalling(true);
      const data = await apiFetch<{ url: string }>("/repositories/installation-url");
      window.location.href = data.url;
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to get installation URL");
      setIsInstalling(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/repositories", {
        method: "POST",
        data: { installationId, owner, name, githubUrl, defaultBranch }
      });
      setIsConnecting(false);
      setOwner("");
      setName("");
      setGithubUrl("");
      setDefaultBranch("main");
      fetchData();
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to connect repository");
    }
  };

  if (loading) return <div className="p-xl">Loading...</div>;

  if (isConnecting) {
    return (
      <div className="max-w-[600px] mx-auto mt-xl">
        <div className="flex items-center justify-between mb-lg">
          <h1 className="text-display-md tracking-[-0.96px] text-ink font-semibold">Connect Repository</h1>
          <Button variant="ghost" onClick={() => setIsConnecting(false)}>Cancel</Button>
        </div>
        
        <CardSoft>
          {installations.length === 0 ? (
            <div className="text-center py-lg">
              <p className="text-body text-[16px] mb-md">You need to install the CodeTrace GitHub App first.</p>
              <Button onClick={handleInstallClick} disabled={isInstalling}>
                {isInstalling ? "Redirecting..." : "Install GitHub App"}
              </Button>
              {error && <p className="text-error mt-sm text-[14px]">{error}</p>}
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-md">
              <div>
                <label className="block text-[14px] font-medium text-ink mb-xs">GitHub Installation</label>
                <select 
                  className="flex w-full bg-canvas text-ink border border-hairline rounded-sm px-sm h-[40px] text-[14px] focus:outline-none focus:ring-2 focus:ring-primary"
                  value={installationId}
                  onChange={(e) => setInstallationId(e.target.value)}
                  required
                >
                  {installations.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      App Installation ({inst.githubInstallationId})
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-right">
                  <button type="button" onClick={handleInstallClick} className="text-link text-[12px] hover:underline">
                    Install on another account
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-[14px] font-medium text-ink mb-xs">Owner</label>
                  <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. octocat" required />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-ink mb-xs">Repository Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. hello-world" required />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-ink mb-xs">GitHub URL</label>
                <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/owner/repo" type="url" required />
              </div>

              <div>
                <label className="block text-[14px] font-medium text-ink mb-xs">Default Branch</label>
                <Input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} placeholder="main" required />
              </div>

              {error && <p className="text-error text-[14px] bg-error-soft p-sm rounded-xs">{error}</p>}

              <div className="pt-sm">
                <Button type="submit" className="w-full">Connect Repository</Button>
              </div>
            </form>
          )}
        </CardSoft>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-xl">
        <h1 className="text-[32px] tracking-[-1.28px] text-ink font-semibold">Repositories</h1>
        {repositories.length > 0 && (
          <Button variant="icon-circular" onClick={() => setIsConnecting(true)} aria-label="Add repository">
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {repositories.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon>
            <FolderGit2 className="w-12 h-12" />
          </EmptyStateIcon>
          <EmptyStateTitle>No repositories connected</EmptyStateTitle>
          <EmptyStateDescription>
            Connect a GitHub repository to start indexing and chatting with your codebase.
          </EmptyStateDescription>
          <Button onClick={() => setIsConnecting(true)}>Connect Repository</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {repositories.map((repo) => (
            <Link key={repo.id} to={`/repositories/${repo.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md">
              <CardSoft className="h-full transition-shadow hover:shadow-[0_2px_2px_#0000000a,0_8px_8px_-8px_#0000000a] cursor-pointer group">
                <div className="flex items-start justify-between mb-md">
                  <h3 className="font-semibold text-[20px] tracking-[-0.6px] text-ink group-hover:text-link transition-colors truncate pr-4">
                    {repo.owner}/{repo.name}
                  </h3>
                  <Badge variant={
                    repo.status === "INDEXED" ? "success" :
                    repo.status === "FAILED" ? "error" : "warning"
                  }>
                    {repo.status}
                  </Badge>
                </div>
                <div className="text-[14px] text-body font-mono truncate">
                  {repo.defaultBranch}
                </div>
              </CardSoft>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
