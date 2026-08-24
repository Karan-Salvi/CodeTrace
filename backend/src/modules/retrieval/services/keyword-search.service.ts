import { prisma } from "../../../database/client.js";
import type { RankedChunk } from "../types/retrieval.types.js";

export async function keywordSearch(
  repositoryId: string,
  queryText: string,
  limit: number
): Promise<RankedChunk[]> {
  // plainto_tsquery ANDs every token by default — the 'simple' config
  // (database.md: deliberate, code identifiers aren't English words)
  // does not strip stopwords the way 'english' would, so a natural
  // question like "How are errors handled?" required "how" AND "are" to
  // literally appear in the content, guaranteeing zero matches for any
  // query that wasn't already a bare code identifier. Building an
  // OR-query from the query's own lexemes (via the same 'simple'
  // tokenizer used on the document side, so terms line up exactly) means
  // any one shared keyword is enough to match, same as a real search
  // engine — while ts_rank still ranks chunks matching MORE terms higher.
  if (!queryText.trim()) return [];

  // fts_normalize/split_identifier_words (migration
  // 20260824180000_fts_split_identifier_words, backend/prisma/sql/indexes.sql):
  // 'simple' never splits camelCase/snake_case, so "sendEmailNotification"
  // was one lexeme and a prose question sharing "notification" as a
  // standalone word never matched it. This expression MUST match
  // chunks_fts_idx's index expression exactly, or Postgres can't use the
  // index for this query.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH query AS (
      SELECT to_tsquery('simple', string_agg(lexeme, ' | ')) AS tsq
      FROM unnest(tsvector_to_array(to_tsvector('simple', fts_normalize(${queryText})))) AS lexeme
    )
    SELECT id
    FROM chunks, query
    WHERE repository_id = ${repositoryId}
      AND query.tsq IS NOT NULL
      AND to_tsvector('simple', fts_normalize(symbol) || ' ' || fts_normalize(coalesce(parent_symbol, '')) || ' ' || fts_normalize(content)) @@ query.tsq
    ORDER BY ts_rank(
      to_tsvector('simple', fts_normalize(symbol) || ' ' || fts_normalize(coalesce(parent_symbol, '')) || ' ' || fts_normalize(content)),
      query.tsq
    ) DESC
    LIMIT ${limit}
  `;

  return rows.map((row, index) => ({ chunkId: row.id, rank: index + 1 }));
}
