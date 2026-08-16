export interface ChangedLineRange {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface ChunkRef {
  chunkId: string;
  symbol: string;
  filePath: string;
}

export interface RiskFactor {
  code: string;
  points: number;
  reason: string;
}

export interface PrFinding {
  category: "BUG" | "SECURITY" | "PERFORMANCE" | "LOGIC" | "TESTING" | "MAINTAINABILITY";
  file: string;
  line: number;
  explanation: string;
  relatedSymbol: string | null;
  citation: { file: string; startLine: number; endLine: number; chunkId: string } | null;
}
