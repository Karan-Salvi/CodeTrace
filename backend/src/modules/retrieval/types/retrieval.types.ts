export interface RankedChunk {
  chunkId: string;
  rank: number;
}

export interface RetrievedChunk {
  id: string;
  repositoryId: string;
  fileId: string;
  symbol: string;
  symbolType: string;
  parentSymbol: string | null;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  filePath: string;
}
