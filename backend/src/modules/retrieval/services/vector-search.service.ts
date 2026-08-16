import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import type { RankedChunk } from "../types/retrieval.types.js";

export async function vectorSearch(
  repositoryId: string,
  queryVector: number[],
  limit: number
): Promise<RankedChunk[]> {
  const vectorLiteral = `[${queryVector.join(",")}]`;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id
    FROM chunks c
    JOIN embeddings e
      ON e.content_hash = c.content_hash
     AND e.model_version = c.embedding_model_version
    WHERE c.repository_id = ${repositoryId}
      AND e.model_version = ${env.EMBEDDING_MODEL_VERSION}
    ORDER BY e.vector <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;

  return rows.map((row, index) => ({ chunkId: row.id, rank: index + 1 }));
}
