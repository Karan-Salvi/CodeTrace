-- split_identifier_words (20260824180000_fts_split_identifier_words) only
-- split at a lowercase/digit -> uppercase boundary, so an acronym-prefixed
-- identifier like "parseHTTPResponse" produced "parse HTTPResponse" — the
-- HTTP/Response boundary (an uppercase run followed by a Titlecase word)
-- was never split, so a prose question containing "response" still missed
-- it. Second pass handles that boundary too.
--
-- CREATE OR REPLACE FUNCTION does not retroactively update rows already
-- computed into chunks_fts_idx (GIN functional indexes store the computed
-- value at write time, not a live formula) — REINDEX recomputes them.

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

REINDEX INDEX chunks_fts_idx;
