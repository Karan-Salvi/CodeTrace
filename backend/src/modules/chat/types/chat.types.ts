export interface ChatContextChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  chunkId: string;
}
