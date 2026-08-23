export type RelationshipTypeName = "CALLS" | "IMPORTS" | "EXTENDS" | "IMPLEMENTS";

export interface FileGraphNode {
  id: string; // file id
  path: string;
  symbolCount: number;
  topSymbols: Array<{ chunkId: string; symbol: string }>; // up to 5, most-connected first
}

export interface FileGraphEdge {
  source: string; // file id
  target: string; // file id
  counts: Record<RelationshipTypeName, number>;
}

export interface FileGraphResponse {
  scope: "file";
  nodes: FileGraphNode[];
  edges: FileGraphEdge[];
}

export interface SymbolGraphNode {
  id: string; // chunk id, or `external:${externalTarget}` for external nodes
  symbol: string;
  symbolType: "FUNCTION" | "METHOD" | "CLASS" | "INTERFACE" | null; // null for external nodes
  file: string | null; // file path, null for external nodes
  startLine: number | null;
  external: boolean;
}

export interface SymbolGraphEdge {
  source: string;
  target: string;
  type: RelationshipTypeName;
}

export interface SymbolGraphResponse {
  scope: "symbol";
  root: string;
  nodes: SymbolGraphNode[];
  edges: SymbolGraphEdge[];
}
