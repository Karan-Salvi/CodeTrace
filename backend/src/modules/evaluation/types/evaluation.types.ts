export type EvalConfig = "VECTOR_ONLY" | "KEYWORD_ONLY" | "HYBRID" | "HYBRID_RERANKED";

export interface ExpectedChunkIdentity {
  path: string;
  symbol: string;
}
