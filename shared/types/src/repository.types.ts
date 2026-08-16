export type RepositoryStatus =
  | "PENDING"
  | "CLONING"
  | "PARSING"
  | "CHUNKING"
  | "EMBEDDING"
  | "STORING"
  | "INDEXED"
  | "FAILED";

export interface RepositoryDTO {
  id: string;
  owner: string;
  name: string;
  githubUrl: string;
  defaultBranch: string;
  currentCommitSha: string | null;
  status: RepositoryStatus;
  filesIndexed: number;
  chunksIndexed: number;
  embeddingCostUsd: number;
}
