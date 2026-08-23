import { describe, it, expect } from "vitest";
import { aggregateFileGraph, type FileRelationshipRow, type FileChunkRow } from "./graph.service.js";

const chunks: FileChunkRow[] = [
  { fileId: "file-a", filePath: "src/a.ts", chunkId: "chunk-a1", symbol: "fnA1" },
  { fileId: "file-a", filePath: "src/a.ts", chunkId: "chunk-a2", symbol: "fnA2" },
  { fileId: "file-b", filePath: "src/b.ts", chunkId: "chunk-b1", symbol: "fnB1" },
];

describe("aggregateFileGraph", () => {
  it("builds one node per file with correct symbolCount", () => {
    const result = aggregateFileGraph([], chunks);
    expect(result.nodes).toHaveLength(2);
    const fileA = result.nodes.find((n) => n.id === "file-a");
    expect(fileA?.symbolCount).toBe(2);
  });

  it("aggregates same-type relationships between two files into one edge with a count", () => {
    const relationships: FileRelationshipRow[] = [
      { relationshipType: "CALLS", fromChunkId: "chunk-a1", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
      { relationshipType: "CALLS", fromChunkId: "chunk-a2", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
    ];
    const result = aggregateFileGraph(relationships, chunks);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ source: "file-a", target: "file-b" });
    expect(result.edges[0].counts.CALLS).toBe(2);
    expect(result.edges[0].counts.IMPORTS).toBe(0);
  });

  it("merges different relationship types between the same file pair onto one edge", () => {
    const relationships: FileRelationshipRow[] = [
      { relationshipType: "CALLS", fromChunkId: "chunk-a1", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
      { relationshipType: "IMPORTS", fromChunkId: "chunk-a1", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
    ];
    const result = aggregateFileGraph(relationships, chunks);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].counts).toMatchObject({ CALLS: 1, IMPORTS: 1 });
  });

  it("excludes relationships with a null toChunkId (external targets)", () => {
    const relationships: FileRelationshipRow[] = [
      { relationshipType: "CALLS", fromChunkId: "chunk-a1", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: null, toFileId: null, toFilePath: null },
    ];
    const result = aggregateFileGraph(relationships, chunks);
    expect(result.edges).toHaveLength(0);
  });

  it("excludes self-referential relationships (same file on both sides)", () => {
    const relationships: FileRelationshipRow[] = [
      { relationshipType: "CALLS", fromChunkId: "chunk-a1", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-a2", toFileId: "file-a", toFilePath: "src/a.ts" },
    ];
    const result = aggregateFileGraph(relationships, chunks);
    expect(result.edges).toHaveLength(0);
  });

  it("ranks topSymbols by relationship count descending, capped at 5", () => {
    const manyChunks: FileChunkRow[] = Array.from({ length: 7 }, (_, i) => ({
      fileId: "file-a",
      filePath: "src/a.ts",
      chunkId: `chunk-${i}`,
      symbol: `fn${i}`,
    }));
    // chunk-3 has 2 outgoing relationships, everything else has 0 or 1
    const relationships: FileRelationshipRow[] = [
      { relationshipType: "CALLS", fromChunkId: "chunk-3", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
      { relationshipType: "CALLS", fromChunkId: "chunk-3", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
      { relationshipType: "CALLS", fromChunkId: "chunk-1", fromFileId: "file-a", fromFilePath: "src/a.ts", toChunkId: "chunk-b1", toFileId: "file-b", toFilePath: "src/b.ts" },
    ];
    const result = aggregateFileGraph(relationships, [
      ...manyChunks,
      { fileId: "file-b", filePath: "src/b.ts", chunkId: "chunk-b1", symbol: "fnB1" },
    ]);
    const fileA = result.nodes.find((n) => n.id === "file-a")!;
    expect(fileA.topSymbols).toHaveLength(5);
    expect(fileA.topSymbols[0].chunkId).toBe("chunk-3");
  });

  it("returns an empty graph for no relationships and no chunks", () => {
    const result = aggregateFileGraph([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});
