import { describe, it, expect } from "vitest";
import { aggregateFileGraph, type FileRelationshipRow, type FileChunkRow, buildSymbolGraph, type SymbolChunkRef, type OutgoingEdgeRow, type IncomingEdgeRow } from "./graph.service.js";

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

describe("buildSymbolGraph", () => {
  const root: SymbolChunkRef = { id: "root", symbol: "login", symbolType: "METHOD", filePath: "src/auth.ts", startLine: 10 };
  const callee: SymbolChunkRef = { id: "callee", symbol: "hashPassword", symbolType: "FUNCTION", filePath: "src/crypto.ts", startLine: 3 };
  const caller: SymbolChunkRef = { id: "caller", symbol: "handleLoginRequest", symbolType: "FUNCTION", filePath: "src/routes.ts", startLine: 20 };

  it("includes the root node itself", () => {
    const result = buildSymbolGraph(root, [], []);
    expect(result.nodes.find((n) => n.id === "root")).toBeDefined();
  });

  it("adds a node and edge for each outgoing relationship", () => {
    const outgoing: OutgoingEdgeRow[] = [{ relationshipType: "CALLS", target: callee, externalTarget: null }];
    const result = buildSymbolGraph(root, outgoing, []);
    expect(result.nodes.find((n) => n.id === "callee")).toBeDefined();
    expect(result.edges).toContainEqual({ source: "root", target: "callee", type: "CALLS" });
  });

  it("adds a node and edge for each incoming relationship", () => {
    const incoming: IncomingEdgeRow[] = [{ relationshipType: "CALLS", source: caller }];
    const result = buildSymbolGraph(root, [], incoming);
    expect(result.nodes.find((n) => n.id === "caller")).toBeDefined();
    expect(result.edges).toContainEqual({ source: "caller", target: "root", type: "CALLS" });
  });

  it("renders an external target as a leaf node with external: true", () => {
    const outgoing: OutgoingEdgeRow[] = [{ relationshipType: "CALLS", target: null, externalTarget: "console.log" }];
    const result = buildSymbolGraph(root, outgoing, []);
    const externalNode = result.nodes.find((n) => n.id === "external:console.log");
    expect(externalNode).toMatchObject({ symbol: "console.log", external: true, symbolType: null, file: null, startLine: null });
    expect(result.edges).toContainEqual({ source: "root", target: "external:console.log", type: "CALLS" });
  });

  it("dedupes the same target appearing via multiple relationship rows into one node, keeping one edge per relationship type", () => {
    const outgoing: OutgoingEdgeRow[] = [
      { relationshipType: "CALLS", target: callee, externalTarget: null },
      { relationshipType: "CALLS", target: callee, externalTarget: null },
    ];
    const result = buildSymbolGraph(root, outgoing, []);
    expect(result.nodes.filter((n) => n.id === "callee")).toHaveLength(1);
    expect(result.edges.filter((e) => e.target === "callee")).toHaveLength(1);
  });
});
