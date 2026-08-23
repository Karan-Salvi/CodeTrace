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

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isOperator: boolean;
}

export interface UsageSummaryResponse {
  rangeDays: 7 | 30 | 90;
  totals: {
    costUsd: number;
    tokens: number;
    calls: number;
    byKind: Record<"QA" | "PR_REVIEW", { costUsd: number; tokens: number; calls: number }>;
  };
  daily: Array<{ date: string; costUsd: number; calls: number }>;
  topRepositories: Array<{ repositoryId: string; owner: string; name: string; costUsd: number; calls: number }>;
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

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type PrReviewStatus = "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";

export interface PrFindingCitation {
  file: string;
  startLine: number;
  endLine: number;
  chunkId: string;
}

export interface PrFinding {
  category: "BUG" | "SECURITY" | "PERFORMANCE" | "LOGIC" | "TESTING" | "MAINTAINABILITY";
  file: string;
  line: number;
  explanation: string;
  relatedSymbol: string | null;
  citation: PrFindingCitation | null;
}

export interface PrRiskFactor {
  code: string;
  points: number;
  reason: string;
}

export interface PrReview {
  id: string;
  pullRequestId: string;
  commitSha: string;
  status: PrReviewStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  riskFactors: PrRiskFactor[] | null;
  findings: PrFinding[] | null;
  failureReason: string | null;
  writebackFailedAt: string | null;
  createdAt: string;
}

export interface PullRequest {
  id: string;
  githubPrNumber: number;
  title: string;
  author: string;
  baseSha: string;
  headSha: string;
  createdAt: string;
  latestReview: PrReview | null;
}

export interface PrDiffContent {
  original?: string;
  modified?: string;
  language?: string;
  previewUnavailable?: boolean;
}

export interface ChunkContent {
  content: string;
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export type RelationshipTypeName = "CALLS" | "IMPORTS" | "EXTENDS" | "IMPLEMENTS";

export interface FileGraphNode {
  id: string;
  path: string;
  symbolCount: number;
  topSymbols: Array<{ chunkId: string; symbol: string }>;
}

export interface FileGraphEdge {
  source: string;
  target: string;
  counts: Record<RelationshipTypeName, number>;
}

export interface FileGraphResponse {
  scope: "file";
  nodes: FileGraphNode[];
  edges: FileGraphEdge[];
}

export interface SymbolGraphNode {
  id: string;
  symbol: string;
  symbolType: "FUNCTION" | "METHOD" | "CLASS" | "INTERFACE" | null;
  file: string | null;
  startLine: number | null;
  external: boolean;
}

export interface SymbolGraphEdge {
  source: string;
  target: string;
  type: RelationshipTypeName;
}

export interface SymbolGraphResponse {
  scope: "symbol";
  root: string;
  nodes: SymbolGraphNode[];
  edges: SymbolGraphEdge[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}
