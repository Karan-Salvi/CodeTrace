import { prisma } from "../../../database/client.js";
import type { ChangedLineRange, ChunkRef } from "../types/pr-review.types.js";

export async function mapChangedLinesToChunks(
  repositoryId: string,
  changedRanges: ChangedLineRange[]
): Promise<ChunkRef[]> {
  const results: ChunkRef[] = [];

  for (const range of changedRanges) {
    const file = await prisma.file.findUnique({
      where: { repositoryId_path: { repositoryId, path: range.filePath } },
    });
    if (!file) continue;

    // pr-review.md: a changed symbol is any chunk whose range overlaps the diff
    const overlapping = await prisma.chunk.findMany({
      where: {
        fileId: file.id,
        startLine: { lte: range.endLine },
        endLine: { gte: range.startLine },
      },
    });

    for (const chunk of overlapping) {
      results.push({ chunkId: chunk.id, symbol: chunk.symbol, filePath: range.filePath });
    }
  }

  return results;
}
