export type IndexJobType = "FULL" | "INCREMENTAL";

export type IndexJobStatus =
  | "PENDING"
  | "CLONING"
  | "PARSING"
  | "CHUNKING"
  | "EMBEDDING"
  | "STORING"
  | "INDEXED"
  | "FAILED"
  | "RETRY";

export interface IndexJobPayload {
  jobId: string;
  repositoryId: string;
  type: IndexJobType;
}

export interface PrReviewJobPayload {
  jobId: string;
  pullRequestId: string;
  repositoryId: string;
  commitSha: string;
}
