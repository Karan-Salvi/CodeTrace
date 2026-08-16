import { env } from "../../../config/env.js";
import { RETRIEVAL_FINAL_K } from "../../../config/constants.js";
import type { RetrievedChunk } from "../types/retrieval.types.js";

export type RerankFn = (query: string, candidates: RetrievedChunk[]) => Promise<RetrievedChunk[]>;

interface JinaRerankResponse {
  model: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
  };
  results: Array<{
    index: number;
    document: { text: string };
    relevance_score: number;
  }>;
}

export async function rerank(query: string, candidates: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  if (candidates.length === 0) return [];

  const documents = candidates.map(
    (c) => `${c.filePath} (${c.symbol}):\n${c.content}`
  );

  try {
    const response = await fetch("https://api.jina.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "jina-reranker-v3.5",
        query,
        documents,
        top_n: RETRIEVAL_FINAL_K,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout to prevent hanging the chat
    });

    if (!response.ok) {
      throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as JinaRerankResponse;
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error("Invalid response from Jina API");
    }

    // Results are already ordered by relevance_score descending from
    // Jina. A malformed/out-of-range result.index (provider bug, or a
    // response shape drift this type doesn't catch at runtime) must not
    // silently produce `undefined` entries in the returned array — that
    // would propagate into chat.service.ts/pr-review.service.ts as a
    // hole in the LLM context instead of failing loudly or falling back
    // cleanly, worse than either.
    const reranked = data.results
      .map((result) => candidates[result.index])
      .filter((chunk): chunk is RetrievedChunk => chunk !== undefined);

    if (reranked.length === 0) {
      throw new Error("Jina API returned no valid result indices");
    }

    return reranked;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Reranker provider failed, falling back to RRF ordering",
        error: err instanceof Error ? err.message : String(err),
      })
    );
    // Graceful fallback to RRF-truncated order
    return candidates.slice(0, RETRIEVAL_FINAL_K);
  }
}
