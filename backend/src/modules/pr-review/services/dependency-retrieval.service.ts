import { prisma } from "../../../database/client.js";
import type { ChunkRef } from "../types/pr-review.types.js";

// pr-review.md: one-hop walk of symbol_relationships pulls in
// callers/callees so the reviewer sees usage context, not just the diff.
export async function getOneHopDependencies(repositoryId: string, chunkIds: string[]): Promise<ChunkRef[]> {
  if (chunkIds.length === 0) return [];

  const relationships = await prisma.symbolRelationship.findMany({
    where: {
      repositoryId,
      OR: [{ toChunkId: { in: chunkIds } }, { fromChunkId: { in: chunkIds } }],
    },
    include: {
      fromChunk: { include: { file: { select: { path: true } } } },
      toChunk: { include: { file: { select: { path: true } } } },
    },
  });

  const results: ChunkRef[] = [];
  const seen = new Set<string>();

  for (const rel of relationships) {
    if (!chunkIds.includes(rel.fromChunkId) && !seen.has(rel.fromChunk.id)) {
      results.push({ chunkId: rel.fromChunk.id, symbol: rel.fromChunk.symbol, filePath: rel.fromChunk.file.path });
      seen.add(rel.fromChunk.id);
    }
    if (rel.toChunk && !chunkIds.includes(rel.toChunk.id) && !seen.has(rel.toChunk.id)) {
      results.push({ chunkId: rel.toChunk.id, symbol: rel.toChunk.symbol, filePath: rel.toChunk.file.path });
      seen.add(rel.toChunk.id);
    }
  }

  return results;
}

// pr-review.md: "same symbol name referenced in a file matching a test
// path pattern" — this is the single implementation the risk score's
// "no test file touched" factor also calls, not a second mechanism.
export async function hasTestCoverage(repositoryId: string, symbol: string): Promise<boolean> {
  const testFilePatterns = ["%.test.%", "%.spec.%", "%__tests__%"];

  const testChunk = await prisma.chunk.findFirst({
    where: {
      repositoryId,
      symbol: { contains: symbol },
      file: {
        OR: testFilePatterns.map((pattern) => ({ path: { contains: pattern.replace(/%/g, "") } })),
      },
    },
  });

  return testChunk !== null;
}
