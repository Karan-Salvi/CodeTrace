// Matches the real Prisma RepositoryStatus enum
// (backend/prisma/schema.prisma) and shared/types/src/repository.types.ts
// exactly — the previous version of this type
// ("PENDING" | "INDEXING" | "READY" | "FAILED") didn't match any real
// backend value, so every status-dependent UI branch (the "READY"/done
// state especially) was unreachable in practice.
export type RepositoryStatus =
  | "PENDING"
  | "CLONING"
  | "PARSING"
  | "CHUNKING"
  | "EMBEDDING"
  | "STORING"
  | "INDEXED"
  | "FAILED";

// The controller returns the raw Prisma row (shared/types'
// RepositoryDTO exists but has zero real references — confirmed by
// grep — so this mirrors the actual row shape, not that unused type).
// embeddingCostUsd arrives as a JSON STRING (Prisma Decimal's own
// toJSON()), not a number — callers must Number(...) it before any
// arithmetic.
export interface Repository {
  id: string;
  userId: string;
  installationId: string;
  owner: string;
  name: string;
  githubUrl: string;
  defaultBranch: string;
  currentCommitSha: string | null;
  status: RepositoryStatus;
  filesIndexed: number;
  chunksIndexed: number;
  embeddingCostUsd: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryInstallation {
  id: string;
  githubInstallationId: string;
  createdAt: string;
}

export interface IndexJob {
  id: string;
  repositoryId: string;
  type: "FULL" | "INCREMENTAL";
  status: RepositoryStatus | "RETRY";
}

export interface Citation {
  file: string;
  startLine: number;
  endLine: number;
  chunkId: string;
}

export interface Conversation {
  id: string;
  repositoryId: string;
  userId: string;
  title: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: Citation[];
  createdAt: string;
}
