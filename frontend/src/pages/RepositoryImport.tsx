import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import type { Repository, RepositoryInstallation } from "../types";
import { CardSoft } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { EmptyState, EmptyStateTitle, EmptyStateDescription, EmptyStateIcon } from "../components/ui/empty-state";
import { FolderGit2 } from "lucide-react";

interface AvailableRepo {
  owner: string;
  name: string;
  githubUrl: string;
  defaultBranch: string;
  private: boolean;
  alreadyConnected: boolean;
}

export function RepositoryImport() {
  const navigate = useNavigate();
  const [installations, setInstallations] = useState<RepositoryInstallation[]>([]);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [importingKey, setImportingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const instData = await apiFetch<RepositoryInstallation[]>("/repositories/installations");
        setInstallations(instData || []);
        if (instData && instData.length > 0) {
          const repos = await apiFetch<AvailableRepo[]>(
            `/repositories/installations/${instData[0].id}/available-repos`
          );
          setAvailableRepos(repos || []);
        }
      } catch (e) {
        setError((e as Error).message || "Failed to load repositories");
      } finally {
        setLoading(false);
      }
    })();
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

  const handleImport = async (repo: AvailableRepo) => {
    const key = `${repo.owner}/${repo.name}`;
    setError("");
    setImportingKey(key);
    try {
      const created = await apiFetch<Repository>("/repositories", {
        method: "POST",
        data: {
          installationId: installations[0].id,
          owner: repo.owner,
          name: repo.name,
          githubUrl: repo.githubUrl,
          defaultBranch: repo.defaultBranch,
        },
      });
      navigate(`/repositories/${created.id}`);
    } catch (e) {
      setError((e as Error).message || "Failed to import repository");
      setImportingKey(null);
    }
  };

  if (loading) return <div className="p-xl">Loading...</div>;

  const filteredRepos = availableRepos.filter((repo) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return repo.name.toLowerCase().includes(q) || repo.owner.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-[700px] mx-auto mt-xl">
      <div className="flex items-center justify-between mb-lg">
        <h1 className="text-display-md tracking-[-0.96px] text-ink font-semibold">Import Git Repository</h1>
        <Button variant="ghost" onClick={() => navigate("/repositories")}>Back</Button>
      </div>

      {error && <p className="text-error text-[14px] bg-error-soft p-sm rounded-xs mb-md">{error}</p>}

      {installations.length === 0 ? (
        <EmptyState className="border border-hairline bg-canvas">
          <EmptyStateIcon>
            <FolderGit2 className="w-8 h-8 text-mute" />
          </EmptyStateIcon>
          <EmptyStateTitle>No GitHub App installed</EmptyStateTitle>
          <EmptyStateDescription>
            You need to install the CodeTrace GitHub App first.
          </EmptyStateDescription>
          <Button onClick={handleInstallClick} disabled={isInstalling}>
            {isInstalling ? "Redirecting..." : "Install GitHub App"}
          </Button>
        </EmptyState>
      ) : (
        <CardSoft>
          <div className="flex items-center justify-between mb-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories..."
              className="max-w-[300px]"
            />
            <button type="button" onClick={handleInstallClick} className="text-link text-[12px] hover:underline">
              Install on another account
            </button>
          </div>

          {filteredRepos.length === 0 ? (
            <p className="text-body text-[14px] text-center py-lg">No repositories match</p>
          ) : (
            <div className="divide-y divide-hairline">
              {filteredRepos.map((repo) => {
                const key = `${repo.owner}/${repo.name}`;
                const isImporting = importingKey === key;
                return (
                  <div key={key} className="flex items-center justify-between py-sm gap-md">
                    <div className="flex items-center gap-sm min-w-0">
                      <span className="text-[14px] text-ink truncate">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.private && <Badge variant="secondary">Private</Badge>}
                    </div>
                    {repo.alreadyConnected ? (
                      <span className="text-[13px] text-mute flex-shrink-0">Imported</span>
                    ) : (
                      <Button
                        variant="secondary-sm"
                        className="flex-shrink-0"
                        disabled={isImporting}
                        onClick={() => handleImport(repo)}
                      >
                        {isImporting ? "Importing..." : "Import"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardSoft>
      )}
    </div>
  );
}
