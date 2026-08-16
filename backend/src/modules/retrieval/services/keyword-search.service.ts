import { prisma } from "../../../database/client.js";
import type { RankedChunk } from "../types/retrieval.types.js";

export async function keywordSearch(
  repositoryId: string,
  queryText: string,
  limit: number
): Promise<RankedChunk[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM chunks
    WHERE repository_id = ${repositoryId}
      AND to_tsvector('simple', symbol || ' ' || coalesce(parent_symbol, '') || ' ' || content)
          @@ plainto_tsquery('simple', ${queryText})
    ORDER BY ts_rank(
      to_tsvector('simple', symbol || ' ' || coalesce(parent_symbol, '') || ' ' || content),
      plainto_tsquery('simple', ${queryText})
    ) DESC
    LIMIT ${limit}
  `;

  return rows.map((row, index) => ({ chunkId: row.id, rank: index + 1 }));
}
