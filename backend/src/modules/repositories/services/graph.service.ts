import type { RelationshipTypeName } from "../types/graph.types.js";

export interface FileRelationshipRow {
  relationshipType: RelationshipTypeName;
  fromChunkId: string;
  fromFileId: string;
  fromFilePath: string;
  toChunkId: string | null;
  toFileId: string | null;
  toFilePath: string | null;
}

export interface FileChunkRow {
  fileId: string;
  filePath: string;
  chunkId: string;
  symbol: string;
}

const RELATIONSHIP_TYPES: RelationshipTypeName[] = ["CALLS", "IMPORTS", "EXTENDS", "IMPLEMENTS"];

function emptyCounts(): Record<RelationshipTypeName, number> {
  return { CALLS: 0, IMPORTS: 0, EXTENDS: 0, IMPLEMENTS: 0 };
}

export function aggregateFileGraph(relationships: FileRelationshipRow[], chunks: FileChunkRow[]) {
  // Per-chunk relationship count, used only to rank topSymbols — counts a
  // chunk appearing on either side of a relationship (as caller or callee).
  const relationshipCountByChunk = new Map<string, number>();
  for (const rel of relationships) {
    relationshipCountByChunk.set(rel.fromChunkId, (relationshipCountByChunk.get(rel.fromChunkId) ?? 0) + 1);
    if (rel.toChunkId) {
      relationshipCountByChunk.set(rel.toChunkId, (relationshipCountByChunk.get(rel.toChunkId) ?? 0) + 1);
    }
  }

  const chunksByFile = new Map<string, FileChunkRow[]>();
  for (const chunk of chunks) {
    const list = chunksByFile.get(chunk.fileId) ?? [];
    list.push(chunk);
    chunksByFile.set(chunk.fileId, list);
  }

  const nodes = Array.from(chunksByFile.entries()).map(([fileId, fileChunks]) => {
    const sorted = [...fileChunks].sort((a, b) => {
      const countDiff = (relationshipCountByChunk.get(b.chunkId) ?? 0) - (relationshipCountByChunk.get(a.chunkId) ?? 0);
      return countDiff !== 0 ? countDiff : a.symbol.localeCompare(b.symbol);
    });
    return {
      id: fileId,
      path: fileChunks[0]!.filePath,
      symbolCount: fileChunks.length,
      topSymbols: sorted.slice(0, 5).map((c) => ({ chunkId: c.chunkId, symbol: c.symbol })),
    };
  });

  const edgeByFilePair = new Map<string, { source: string; target: string; counts: Record<RelationshipTypeName, number> }>();
  for (const rel of relationships) {
    if (!rel.toFileId) continue; // external target — no file to draw an edge to
    if (rel.fromFileId === rel.toFileId) continue; // self-referential — not useful at file granularity
    const key = `${rel.fromFileId}->${rel.toFileId}`;
    const edge = edgeByFilePair.get(key) ?? { source: rel.fromFileId, target: rel.toFileId, counts: emptyCounts() };
    edge.counts[rel.relationshipType] += 1;
    edgeByFilePair.set(key, edge);
  }

  return { nodes, edges: Array.from(edgeByFilePair.values()) };
}

// Referenced so the compiler doesn't flag it as unused if a future edit
// trims the RELATIONSHIP_TYPES usage above — kept for the symbol-level
// function in Task 3, which lives in this same file.
void RELATIONSHIP_TYPES;
