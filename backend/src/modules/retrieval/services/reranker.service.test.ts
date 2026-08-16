import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rerank } from "./reranker.service.js";
import { RETRIEVAL_FINAL_K } from "../../../config/constants.js";
import type { RetrievedChunk } from "../types/retrieval.types.js";

describe("rerank", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const makeMockCandidates = (count: number): RetrievedChunk[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `chunk-${i}`,
      repositoryId: "repo-1",
      fileId: "file-1",
      symbol: `func${i}`,
      symbolType: "function",
      parentSymbol: null,
      language: "typescript",
      startLine: i * 10,
      endLine: (i + 1) * 10,
      content: `const func${i} = () => {};`,
      filePath: "src/index.ts",
    }));
  };

  it("returns exactly RETRIEVAL_FINAL_K chunks in the provider's scored order", async () => {
    const candidates = makeMockCandidates(15);
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "jina-reranker-v3.5",
        usage: { total_tokens: 100, prompt_tokens: 100 },
        results: [
          { index: 5, document: { text: "..." }, relevance_score: 0.9 },
          { index: 2, document: { text: "..." }, relevance_score: 0.8 },
          { index: 14, document: { text: "..." }, relevance_score: 0.7 },
          { index: 1, document: { text: "..." }, relevance_score: 0.6 },
          { index: 0, document: { text: "..." }, relevance_score: 0.5 },
          { index: 10, document: { text: "..." }, relevance_score: 0.4 },
          { index: 9, document: { text: "..." }, relevance_score: 0.3 },
          { index: 8, document: { text: "..." }, relevance_score: 0.2 },
        ], // Length is RETRIEVAL_FINAL_K (8)
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await rerank("query", candidates);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(RETRIEVAL_FINAL_K);
    expect(result[0].id).toBe("chunk-5");
    expect(result[1].id).toBe("chunk-2");
    expect(result[2].id).toBe("chunk-14");
    expect(result[7].id).toBe("chunk-8");
  });

  it("gracefully falls back to RRF order truncated to RETRIEVAL_FINAL_K if provider fails", async () => {
    const candidates = makeMockCandidates(15);
    
    // Mock fetch to reject (simulate timeout or network error)
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = fetchMock as unknown as typeof fetch;
    
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await rerank("query", candidates);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(RETRIEVAL_FINAL_K);
    // Should be exactly the first 8 of the original candidates
    expect(result[0].id).toBe("chunk-0");
    expect(result[7].id).toBe("chunk-7");

    consoleErrorSpy.mockRestore();
  });

  it("handles fewer than RETRIEVAL_FINAL_K candidates without error", async () => {
    const candidates = makeMockCandidates(3);
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "jina-reranker-v3.5",
        usage: { total_tokens: 100, prompt_tokens: 100 },
        results: [
          { index: 2, document: { text: "..." }, relevance_score: 0.9 },
          { index: 0, document: { text: "..." }, relevance_score: 0.8 },
          { index: 1, document: { text: "..." }, relevance_score: 0.7 },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await rerank("query", candidates);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("chunk-2");
    expect(result[1].id).toBe("chunk-0");
    expect(result[2].id).toBe("chunk-1");
  });

  it("filters out entries with an out-of-range index instead of returning undefined", async () => {
    // Regression: candidates[result.index] silently returns `undefined`
    // for an out-of-bounds index (malformed/drifted provider response) —
    // that used to propagate as a hole in the returned array straight
    // into chat.service.ts/pr-review.service.ts's LLM context instead of
    // either failing cleanly or falling back to RRF order.
    const candidates = makeMockCandidates(3);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "jina-reranker-v3.5",
        usage: { total_tokens: 100, prompt_tokens: 100 },
        results: [
          { index: 99, document: { text: "..." }, relevance_score: 0.9 }, // out of range
          { index: 1, document: { text: "..." }, relevance_score: 0.8 },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await rerank("query", candidates);

    expect(result.every((chunk) => chunk !== undefined)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("chunk-1");
  });

  it("falls back to RRF order when every result index is out of range", async () => {
    const candidates = makeMockCandidates(5);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "jina-reranker-v3.5",
        usage: { total_tokens: 100, prompt_tokens: 100 },
        results: [{ index: 99, document: { text: "..." }, relevance_score: 0.9 }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await rerank("query", candidates);

    expect(result.every((chunk) => chunk !== undefined)).toBe(true);
    expect(result[0].id).toBe("chunk-0");

    consoleErrorSpy.mockRestore();
  });
});
