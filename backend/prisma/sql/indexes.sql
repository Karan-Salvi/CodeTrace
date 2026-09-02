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
--
-- fts_normalize/split_identifier_words (20260824180000_fts_split_identifier_words):
-- 'simple' never splits camelCase/snake_case, so "sendEmailNotification"
-- is one lexeme and a prose question sharing "notification" as a
-- standalone word never matched it. fts_normalize() appends the
-- boundary-split words alongside the original identifier — additive only,
-- exact-identifier matching above is unaffected.
-- Two boundary passes: lowercase/digit -> uppercase ("sendEmail" ->
-- "send Email") and uppercase-run -> Titlecase word ("parseHTTPResponse"
-- -> "parse HTTP Response", the acronym-suffix case the first pass alone
-- misses — 20260824180500_fts_split_acronym_boundary).
CREATE OR REPLACE FUNCTION split_identifier_words(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(input, ''), '([a-z0-9])([A-Z])', '\1 \2', 'g'),
      '([A-Z]+)([A-Z][a-z])', '\1 \2', 'g'
    ),
    '_', ' ', 'g'
  )
$$;

CREATE OR REPLACE FUNCTION fts_normalize(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(input, '') || ' ' || split_identifier_words(input)
$$;

-- DROP first: on a DB where chunks_fts_idx already exists from the init
-- migration (pre-fts_normalize), `CREATE INDEX IF NOT EXISTS` alone would
-- silently no-op and leave the old, unsplit-identifier definition in
-- place — this file is documented above as runnable standalone ("run once
-- against the DB"), so it must actually replace the index, same as
-- migrations/20260824180000_fts_split_identifier_words/migration.sql does.
--
-- CONCURRENTLY: Postgres never allows this inside a transaction block,
-- and this reliably fails against the real production image (confirmed
-- with a real `docker run` — see
-- backend/scripts/apply-concurrent-migrations.ts's header comment for the
-- full story). Run that script instead of plain `prisma migrate deploy`.
DROP INDEX CONCURRENTLY IF EXISTS chunks_fts_idx;

CREATE INDEX CONCURRENTLY IF NOT EXISTS chunks_fts_idx ON chunks
  USING gin (to_tsvector('simple',
    fts_normalize(symbol) || ' ' || fts_normalize(coalesce(parent_symbol, '')) || ' ' || fts_normalize(content)));
