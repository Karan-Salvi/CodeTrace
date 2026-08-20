import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import type { Repository, RepositoryInstallation } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  EmptyState,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateIcon,
} from "../components/ui/empty-state";
import { FolderGit2, Folder, UserCircle2, Search } from "lucide-react";
import { motion } from "framer-motion";

interface AvailableRepo {
  owner: string;
  name: string;
  githubUrl: string;
  defaultBranch: string;
  private: boolean;
  alreadyConnected: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
};

export function RepositoryImport() {
  const navigate = useNavigate();
  const [installations, setInstallations] = useState<RepositoryInstallation[]>(
    [],
  );
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const instData = await apiFetch<RepositoryInstallation[]>(
          "/repositories/installations",
        );
        setInstallations(instData || []);
        if (instData && instData.length > 0) {
          const repos = await apiFetch<AvailableRepo[]>(
            `/repositories/installations/${instData[0].id}/available-repos`,
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
      const data = await apiFetch<{ url: string }>(
        "/repositories/installation-url",
      );
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

  if (loading)
    return (
      <div className="flex h-full items-center justify-center p-xl">
        <span className="text-mute text-[14px]">Loading repositories...</span>
      </div>
    );

  const filteredRepos = availableRepos.filter((repo) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      repo.name.toLowerCase().includes(q) ||
      repo.owner.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full px-4 md:px-8 py-10 max-w-[800px] mx-auto pb-20">
      <div className="flex items-center justify-between mb-8 mt-4 w-full">
        <h1 className="text-[28px] md:text-[32px] tracking-tight font-semibold text-ink">
          Import Git Repository
        </h1>
        <button
          onClick={() => navigate("/repositories")}
          className="text-[14px] text-mute hover:text-ink transition-colors bg-transparent border-none cursor-pointer font-medium"
        >
          Back
        </button>
      </div>

      {error && (
        <p className="text-error text-[14px] bg-error/10 border border-error/30 p-4 rounded-md mb-6">
          {error}
        </p>
      )}

      {installations.length === 0 ? (
        <EmptyState className="border border-hairline bg-canvas rounded-xl shadow-sm">
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
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="bg-canvas-soft-2 border border-hairline rounded-xl w-full overflow-hidden shadow-sm"
        >
          {/* Search & Actions Bar */}
          <div className="p-5 md:p-8 border-b border-hairline flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              <div className="relative flex-1 w-full max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-mute pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full bg-canvas border-hairline h-14 pl-12 pr-16 text-[15px] text-ink placeholder:text-mute focus:border-ink shadow-sm transition-colors rounded-lg"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                  <span className="font-mono text-[13px] font-medium text-mute bg-[#262626] border border-[#3f3f46] px-2 py-1 rounded shadow-sm">
                    ⌘K
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleInstallClick}
                className="text-[14px] text-mute hover:text-ink transition-colors whitespace-nowrap font-medium cursor-pointer px-4 py-2 hover:bg-canvas-soft rounded-md border border-transparent hover:border-hairline"
              >
                Install on another account
              </button>
            </div>
          </div>

          {/* Repository List */}
          <div className="flex flex-col bg-canvas-soft-2">
            {filteredRepos.length === 0 ? (
              <p className="text-[14px] text-mute text-center py-12">
                No repositories match your search.
              </p>
            ) : (
              filteredRepos.map((repo) => {
                const key = `${repo.owner}/${repo.name}`;
                const isImporting = importingKey === key;

                if (repo.alreadyConnected) {
                  return (
                    <motion.div
                      variants={itemVariants}
                      key={key}
                      className="flex items-center justify-between py-4 px-5 md:px-6 border-b border-hairline last:border-b-0 bg-[#0A0A0A]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Folder className="w-4 h-4 text-mute shrink-0" />
                        <div className="flex items-center gap-1.5 min-w-0">
                          <UserCircle2 className="w-[14px] h-[14px] text-mute shrink-0" />
                          <span className="text-[14px] text-mute font-medium truncate">
                            {repo.owner}/{repo.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-mute text-[13px] px-4 py-1.5 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-success/50"></div>
                        Imported
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    variants={itemVariants}
                    key={key}
                    className="flex items-center justify-between py-4 px-5 md:px-6 border-b border-hairline last:border-b-0 hover:bg-[#1A1A1A] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder className="w-4 h-4 text-mute shrink-0" />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserCircle2 className="w-[14px] h-[14px] text-mute shrink-0" />
                        <span className="text-[14px] text-ink font-medium truncate">
                          {repo.owner}/{repo.name}
                        </span>
                      </div>
                    </div>
                    <button
                      disabled={isImporting}
                      onClick={() => handleImport(repo)}
                      className="bg-transparent border border-hairline text-ink text-[13px] px-4 py-1.5 rounded-md hover:bg-[#262626] hover:border-mute transition-all font-medium shrink-0 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isImporting ? "Importing..." : "Import"}
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}