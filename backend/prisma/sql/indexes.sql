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
