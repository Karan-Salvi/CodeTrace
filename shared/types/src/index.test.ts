import { describe, it, expect } from "vitest";
import type { RepositoryStatus, RepositoryDTO } from "./index.js";

describe("shared types", () => {
  it("RepositoryStatus accepts all documented states", () => {
    const statuses: RepositoryStatus[] = [
      "PENDING", "CLONING", "PARSING", "CHUNKING",
      "EMBEDDING", "STORING", "INDEXED", "FAILED",
    ];
    expect(statuses).toHaveLength(8);
  });

  it("RepositoryDTO shape matches expected fields", () => {
    const repo: RepositoryDTO = {
      id: "repo-1",
      owner: "octocat",
      name: "hello-world",
      githubUrl: "https://github.com/octocat/hello-world",
      defaultBranch: "main",
      currentCommitSha: null,
      status: "PENDING",
      filesIndexed: 0,
      chunksIndexed: 0,
      embeddingCostUsd: 0,
    };
    expect(repo.status).toBe("PENDING");
  });
});
