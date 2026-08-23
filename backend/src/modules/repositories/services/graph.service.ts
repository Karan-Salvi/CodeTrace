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

// Windows-run incremental indexing has historically left duplicate `File`
// rows for the same real file — one path using `/`, one using `\` (a
// path-separator bug in how the worker computed relative paths on that
// OS). Two different `fileId`s that normalize to the same forward-slash
// path are the same file and must render as one graph node, not two —
// otherwise every affected repo shows visibly duplicated, disconnected
// nodes. This is a display-layer merge, not a fix to the underlying rows
// (a real fix belongs in the worker + a data migration, out of scope
// here) — see docs/superpowers/specs/2026-08-23-architecture-view-design.md's
// "Known gap" section precedent for this kind of documented workaround.
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
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

  // Group chunks by normalized path (not raw fileId) so duplicate File
  // rows for the same real file merge into one node. The canonical node
  // id is the lexicographically-smallest fileId in the group — arbitrary
  // but deterministic, so the same file always resolves to the same node
  // id across requests.
  const chunksByPath = new Map<string, FileChunkRow[]>();
  for (const chunk of chunks) {
    const key = normalizePath(chunk.filePath);
    const list = chunksByPath.get(key) ?? [];
    list.push(chunk);
    chunksByPath.set(key, list);
  }

  const canonicalFileIdByRawFileId = new Map<string, string>();
  for (const fileChunks of chunksByPath.values()) {
    const canonicalId = fileChunks.map((c) => c.fileId).sort()[0]!;
    for (const chunk of fileChunks) {
      canonicalFileIdByRawFileId.set(chunk.fileId, canonicalId);
    }
  }

  const nodes = Array.from(chunksByPath.entries()).map(([normalizedPath, fileChunks]) => {
    const sorted = [...fileChunks].sort((a, b) => {
      const countDiff = (relationshipCountByChunk.get(b.chunkId) ?? 0) - (relationshipCountByChunk.get(a.chunkId) ?? 0);
      return countDiff !== 0 ? countDiff : a.symbol.localeCompare(b.symbol);
    });
    return {
      id: canonicalFileIdByRawFileId.get(fileChunks[0]!.fileId)!,
      path: normalizedPath,
      symbolCount: fileChunks.length,
      topSymbols: sorted.slice(0, 5).map((c) => ({ chunkId: c.chunkId, symbol: c.symbol })),
    };
  });

  const edgeByFilePair = new Map<string, { source: string; target: string; counts: Record<RelationshipTypeName, number> }>();
  for (const rel of relationships) {
    if (!rel.toFileId) continue; // external target — no file to draw an edge to
    const fromId = canonicalFileIdByRawFileId.get(rel.fromFileId) ?? rel.fromFileId;
    const toId = canonicalFileIdByRawFileId.get(rel.toFileId) ?? rel.toFileId;
    if (fromId === toId) continue; // self-referential (including across duplicate rows of the same file) — not useful at file granularity
    const key = `${fromId}->${toId}`;
    const edge = edgeByFilePair.get(key) ?? { source: fromId, target: toId, counts: emptyCounts() };
    edge.counts[rel.relationshipType] += 1;
    edgeByFilePair.set(key, edge);
  }

  return { nodes, edges: Array.from(edgeByFilePair.values()) };
}

// Referenced so the compiler doesn't flag it as unused if a future edit
// trims the RELATIONSHIP_TYPES usage above — kept for the symbol-level
// function in Task 3, which lives in this same file.
void RELATIONSHIP_TYPES;

export interface SymbolChunkRef {
  id: string;
  symbol: string;
  symbolType: "FUNCTION" | "METHOD" | "CLASS" | "INTERFACE";
  filePath: string;
  startLine: number;
}

export interface OutgoingEdgeRow {
  relationshipType: RelationshipTypeName;
  target: SymbolChunkRef | null;
  externalTarget: string | null;
}

export interface IncomingEdgeRow {
  relationshipType: RelationshipTypeName;
  source: SymbolChunkRef;
}

function chunkRefToNode(ref: SymbolChunkRef) {
  return { id: ref.id, symbol: ref.symbol, symbolType: ref.symbolType, file: normalizePath(ref.filePath), startLine: ref.startLine, external: false };
}

export function buildSymbolGraph(root: SymbolChunkRef, outgoing: OutgoingEdgeRow[], incoming: IncomingEdgeRow[]) {
  const nodesById = new Map<string, ReturnType<typeof chunkRefToNode> | { id: string; symbol: string; symbolType: null; file: null; startLine: null; external: true }>();
  nodesById.set(root.id, chunkRefToNode(root));

  const edgeKeys = new Set<string>();
  const edges: Array<{ source: string; target: string; type: RelationshipTypeName }> = [];

  for (const row of outgoing) {
    const targetId = row.target ? row.target.id : `external:${row.externalTarget}`;
    if (!nodesById.has(targetId)) {
      nodesById.set(
        targetId,
        row.target
          ? chunkRefToNode(row.target)
          : { id: targetId, symbol: row.externalTarget!, symbolType: null, file: null, startLine: null, external: true }
      );
    }
    const key = `root->${targetId}:${row.relationshipType}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ source: root.id, target: targetId, type: row.relationshipType });
    }
  }

  for (const row of incoming) {
    if (!nodesById.has(row.source.id)) {
      nodesById.set(row.source.id, chunkRefToNode(row.source));
    }
    const key = `${row.source.id}->root:${row.relationshipType}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ source: row.source.id, target: root.id, type: row.relationshipType });
    }
  }

  return { nodes: Array.from(nodesById.values()), edges };
}
