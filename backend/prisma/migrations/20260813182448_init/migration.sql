-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "RepositoryStatus" AS ENUM ('PENDING', 'CLONING', 'PARSING', 'CHUNKING', 'EMBEDDING', 'STORING', 'INDEXED', 'FAILED');

-- CreateEnum
CREATE TYPE "SymbolType" AS ENUM ('FUNCTION', 'METHOD', 'CLASS', 'INTERFACE');

-- CreateEnum
CREATE TYPE "IndexJobStatus" AS ENUM ('PENDING', 'CLONING', 'PARSING', 'CHUNKING', 'EMBEDDING', 'STORING', 'INDEXED', 'FAILED', 'RETRY');

-- CreateEnum
CREATE TYPE "IndexJobType" AS ENUM ('FULL', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "PullRequestStatus" AS ENUM ('OPEN', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PrReviewStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('INDEXING', 'QA', 'PR_REVIEW');

-- CreateEnum
CREATE TYPE "EvalConfig" AS ENUM ('VECTOR_ONLY', 'KEYWORD_ONLY', 'HYBRID', 'HYBRID_RERANKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "github_id" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatar_url" TEXT,
    "github_access_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_installations" (
    "id" TEXT NOT NULL,
    "github_installation_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "github_url" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL,
    "current_commit_sha" TEXT,
    "status" "RepositoryStatus" NOT NULL DEFAULT 'PENDING',
    "files_indexed" INTEGER NOT NULL DEFAULT 0,
    "chunks_indexed" INTEGER NOT NULL DEFAULT 0,
    "embedding_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT,
    "content_hash" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "last_indexed_sha" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbol_type" "SymbolType" NOT NULL,
    "parent_symbol" TEXT,
    "language" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "embedding_model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "content_hash" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "vector" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("content_hash","model_version")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT,
    "authored_at" TIMESTAMP(3),
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "index_jobs" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "type" "IndexJobType" NOT NULL,
    "status" "IndexJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "index_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbol_relationships" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "from_chunk_id" TEXT NOT NULL,
    "to_chunk_id" TEXT,
    "relationship_type" "RelationshipType" NOT NULL,
    "external_target" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "symbol_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "retrieval_meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "github_pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "base_sha" TEXT NOT NULL,
    "head_sha" TEXT NOT NULL,
    "status" "PullRequestStatus" NOT NULL DEFAULT 'OPEN',
    "last_reviewed_sha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_reviews" (
    "id" TEXT NOT NULL,
    "pull_request_id" TEXT NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "status" "PrReviewStatus" NOT NULL DEFAULT 'PENDING',
    "risk_score" INTEGER,
    "risk_level" "RiskLevel",
    "risk_factors" JSONB,
    "findings" JSONB,
    "duration_ms" INTEGER,
    "llm_cost_usd" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "query_id" TEXT,
    "job_id" TEXT,
    "kind" "UsageKind" NOT NULL,
    "retrieval_latency_ms" INTEGER,
    "llm_latency_ms" INTEGER,
    "total_latency_ms" INTEGER,
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "chunks_retrieved" INTEGER,
    "chunks_cited" INTEGER,
    "cache_hit" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_questions" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expected_chunks" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_runs" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "config" "EvalConfig" NOT NULL,
    "recall_at_5" DOUBLE PRECISION NOT NULL,
    "precision_at_5" DOUBLE PRECISION NOT NULL,
    "mrr" DOUBLE PRECISION NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_results" (
    "id" TEXT NOT NULL,
    "eval_run_id" TEXT NOT NULL,
    "eval_question_id" TEXT NOT NULL,
    "retrieved_chunks" JSONB NOT NULL,
    "correct" BOOLEAN NOT NULL,

    CONSTRAINT "eval_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repository_installations_github_installation_id_key" ON "repository_installations"("github_installation_id");

-- CreateIndex
CREATE INDEX "repository_installations_user_id_idx" ON "repository_installations"("user_id");

-- CreateIndex
CREATE INDEX "repositories_user_id_idx" ON "repositories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_user_id_github_url_key" ON "repositories"("user_id", "github_url");

-- CreateIndex
CREATE INDEX "files_repository_id_idx" ON "files"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_repository_id_path_key" ON "files"("repository_id", "path");

-- CreateIndex
CREATE INDEX "chunks_file_id_idx" ON "chunks"("file_id");

-- CreateIndex
CREATE INDEX "chunks_repository_id_symbol_idx" ON "chunks"("repository_id", "symbol");

-- CreateIndex
CREATE INDEX "chunks_content_hash_idx" ON "chunks"("content_hash");

-- CreateIndex
CREATE INDEX "commits_repository_id_idx" ON "commits"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "commits_repository_id_sha_key" ON "commits"("repository_id", "sha");

-- CreateIndex
CREATE INDEX "index_jobs_repository_id_idx" ON "index_jobs"("repository_id");

-- CreateIndex
CREATE INDEX "symbol_relationships_repository_id_from_chunk_id_idx" ON "symbol_relationships"("repository_id", "from_chunk_id");

-- CreateIndex
CREATE INDEX "symbol_relationships_repository_id_to_chunk_id_idx" ON "symbol_relationships"("repository_id", "to_chunk_id");

-- CreateIndex
CREATE INDEX "conversations_repository_id_idx" ON "conversations"("repository_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "pull_requests_repository_id_idx" ON "pull_requests"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_repository_id_github_pr_number_key" ON "pull_requests"("repository_id", "github_pr_number");

-- CreateIndex
CREATE INDEX "pr_reviews_pull_request_id_idx" ON "pr_reviews"("pull_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "webhook_events_repository_id_idx" ON "webhook_events"("repository_id");

-- CreateIndex
CREATE INDEX "usage_logs_repository_id_created_at_idx" ON "usage_logs"("repository_id", "created_at");

-- CreateIndex
CREATE INDEX "eval_questions_repository_id_idx" ON "eval_questions"("repository_id");

-- CreateIndex
CREATE INDEX "eval_results_eval_run_id_idx" ON "eval_results"("eval_run_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_installations" ADD CONSTRAINT "repository_installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "repository_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_content_hash_embedding_model_version_fkey" FOREIGN KEY ("content_hash", "embedding_model_version") REFERENCES "embeddings"("content_hash", "model_version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "index_jobs" ADD CONSTRAINT "index_jobs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relationships" ADD CONSTRAINT "symbol_relationships_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relationships" ADD CONSTRAINT "symbol_relationships_from_chunk_id_fkey" FOREIGN KEY ("from_chunk_id") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relationships" ADD CONSTRAINT "symbol_relationships_to_chunk_id_fkey" FOREIGN KEY ("to_chunk_id") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_reviews" ADD CONSTRAINT "pr_reviews_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_questions" ADD CONSTRAINT "eval_questions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_eval_run_id_fkey" FOREIGN KEY ("eval_run_id") REFERENCES "eval_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_eval_question_id_fkey" FOREIGN KEY ("eval_question_id") REFERENCES "eval_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Raw-SQL index supplements Prisma cannot express.
-- Applied via a hand-edited migration after the initial `prisma migrate dev`
-- (copy into the generated migration.sql, or run once against the DB).
-- Design source: docs/superpowers/specs/2026-08-13-database-schema-design.md

-- ANN index for the vector path of hybrid retrieval (docs/retrieval.md)
CREATE INDEX IF NOT EXISTS embeddings_vector_hnsw_idx ON embeddings
  USING hnsw (vector vector_cosine_ops);

-- Keyword path of hybrid retrieval: 'simple' config, not 'english' —
-- code identifiers must not be stemmed ("handleAuthError" is not prose;
-- stemming hurts the exact-identifier matching this path exists for).
CREATE INDEX IF NOT EXISTS chunks_fts_idx ON chunks
  USING gin (to_tsvector('simple',
    symbol || ' ' || coalesce(parent_symbol, '') || ' ' || content));
