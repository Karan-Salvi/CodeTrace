export type SymbolType = "FUNCTION" | "METHOD" | "CLASS" | "INTERFACE";

export interface ChunkDTO {
  id: string;
  repositoryId: string;
  fileId: string;
  symbol: string;
  symbolType: SymbolType;
  parentSymbol: string | null;
  language: string;
  startLine: number;
  endLine: number;
  filePath: string;
}

export interface Citation {
  file: string;
  startLine: number;
  endLine: number;
  chunkId: string;
}
