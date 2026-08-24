-- Keyword search over camelCase/snake_case identifiers was silently broken
-- for prose questions: to_tsvector('simple', 'sendEmailNotification')
-- produces ONE lexeme ('sendemailnotification'), so a real chat question
-- like "How are users notified about an event?" shares zero tokens with
-- the identifier even though it's an exact semantic match. Confirmed via
-- evaluation/reports — 6/34 keyword-only misses all had this shape.
--
-- Fix: split identifiers on camelCase/snake_case word boundaries and index
-- BOTH the original token and the split words — this only ADDS lexemes, it
-- never removes the original, so exact-identifier matching (the reason
-- 'simple' was chosen over 'english' — chunks_fts_idx's original comment)
-- is untouched. Not stemming: no dictionary normalization, just boundary
-- splitting on already-real word breaks in the identifier.

CREATE OR REPLACE FUNCTION split_identifier_words(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(regexp_replace(coalesce(input, ''), '([a-z0-9])([A-Z])', '\1 \2', 'g'), '_', ' ', 'g')
$$;

CREATE OR REPLACE FUNCTION fts_normalize(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(input, '') || ' ' || split_identifier_words(input)
$$;

DROP INDEX CONCURRENTLY IF EXISTS chunks_fts_idx;

CREATE INDEX CONCURRENTLY IF NOT EXISTS chunks_fts_idx ON chunks
  USING gin (to_tsvector('simple',
    fts_normalize(symbol) || ' ' || fts_normalize(coalesce(parent_symbol, '')) || ' ' || fts_normalize(content)));
