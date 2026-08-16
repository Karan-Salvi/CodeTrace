import { describe, it, expect } from "vitest";
import { mergeRankings, classifyQuery } from "./rrf-merge.service.js";

describe("classifyQuery", () => {
  it("classifies a camelCase identifier as identifier-heavy", () => {
    expect(classifyQuery("what does handleAuthError do")).toBe("identifier");
  });

  it("classifies a snake_case identifier as identifier-heavy", () => {
    expect(classifyQuery("explain content_hash caching")).toBe("identifier");
  });

  it("classifies a plain-English question as semantic", () => {
    expect(classifyQuery("why is the login flow slow")).toBe("semantic");
  });
});

describe("mergeRankings", () => {
  it("ranks a chunk appearing in both lists above one appearing in only one", () => {
    const vectorResults = [
      { chunkId: "a", rank: 1 },
      { chunkId: "b", rank: 2 },
    ];
    const keywordResults = [
      { chunkId: "a", rank: 1 },
      { chunkId: "c", rank: 2 },
    ];

    const merged = mergeRankings(vectorResults, keywordResults, { queryType: "semantic" });
    expect(merged[0].chunkId).toBe("a");
  });

  it("weights the keyword path higher for identifier-heavy queries", () => {
    const vectorResults = [
      { chunkId: "vector-only", rank: 1 },
    ];
    const keywordResults = [
      { chunkId: "keyword-only", rank: 1 },
    ];

    const identifierMerged = mergeRankings(vectorResults, keywordResults, { queryType: "identifier" });
    const semanticMerged = mergeRankings(vectorResults, keywordResults, { queryType: "semantic" });

    // keyword-only should rank at least as well relative to vector-only
    // under identifier weighting as it does under semantic weighting
    const idxIdentifier = identifierMerged.findIndex((r) => r.chunkId === "keyword-only");
    const idxSemantic = semanticMerged.findIndex((r) => r.chunkId === "keyword-only");
    expect(idxIdentifier).toBeLessThanOrEqual(idxSemantic);
  });

  it("never drops a result present in only one list", () => {
    const vectorResults = [{ chunkId: "only-in-vector", rank: 1 }];
    const keywordResults: typeof vectorResults = [];

    const merged = mergeRankings(vectorResults, keywordResults, { queryType: "semantic" });
    expect(merged.some((r) => r.chunkId === "only-in-vector")).toBe(true);
  });
});
