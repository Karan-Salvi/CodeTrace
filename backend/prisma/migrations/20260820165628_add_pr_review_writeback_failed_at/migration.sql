-- AlterTable
-- Note: Prisma's diff engine generated a spurious `DROP INDEX
-- "embeddings_vector_hnsw_idx"` here, because that index is created via
-- raw SQL (backend/prisma/sql/indexes.sql) and isn't represented in
-- schema.prisma, so it looks like drift. Removed manually — dropping it
-- would silently kill pgvector cosine search performance for every
-- retrieval query (chat + PR review), falling back to a full sequential
-- scan over embeddings.
ALTER TABLE "pr_reviews" ADD COLUMN     "writeback_failed_at" TIMESTAMP(3);
