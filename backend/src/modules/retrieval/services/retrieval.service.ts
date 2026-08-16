import { prisma } from "../../../database/client.js";
import { RETRIEVAL_TOP_K } from "../../../config/constants.js";
import { vectorSearch } from "./vector-search.service.js";
import { keywordSearch } from "./keyword-search.service.js";
import { mergeRankings, classifyQuery } from "./rrf-merge.service.js";
import { rerank } from "./reranker.service.js";
import type { RetrievedChunk } from "../types/retrieval.types.js";

export type EmbedQueryFn = (text: string) => Promise<number[]>;

export async function retrieveContext(
  repositoryId: string,
  queryText: string,
  embedQuery: EmbedQueryFn
): Promise<RetrievedChunk[]> {
  const queryVector = await embedQuery(queryText);
  const queryType = classifyQuery(queryText);

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(repositoryId, queryVector, RETRIEVAL_TOP_K),
    keywordSearch(repositoryId, queryText, RETRIEVAL_TOP_K),
  ]);

  const merged = mergeRankings(vectorResults, keywordResults, { queryType });
  const candidateChunkIds = merged.slice(0, RETRIEVAL_TOP_K).map((r) => r.chunkId);

  if (candidateChunkIds.length === 0) return [];

  const chunks = await prisma.chunk.findMany({
    where: { id: { in: candidateChunkIds } },
    include: { file: { select: { path: true } } },
  });

  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  const candidates: RetrievedChunk[] = candidateChunkIds
    .map((id) => chunkById.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c) => ({
      id: c.id,
      repositoryId: c.repositoryId,
      fileId: c.fileId,
      symbol: c.symbol,
      symbolType: c.symbolType,
      parentSymbol: c.parentSymbol,
      language: c.language,
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.content,
      filePath: c.file.path,
    }));

  return rerank(queryText, candidates);
}
