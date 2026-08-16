import { describe, it, expect } from "vitest";
import { validateCitation } from "./citation-validator.service.js";
import type { RetrievedChunk } from "../../retrieval/types/retrieval.types.js";

const retrieved: RetrievedChunk[] = [
  {
    id: "chunk-1",
    repositoryId: "repo-1",
    fileId: "file-1",
    symbol: "handleAuthError",
    symbolType: "FUNCTION",
    parentSymbol: null,
    language: "typescript",
    startLine: 1,
    endLine: 12,
    content: "...",
    filePath: "src/auth/handleAuthError.ts",
  },
];

describe("validateCitation", () => {
  it("accepts a citation matching a retrieved chunk exactly", () => {
    expect(
      validateCitation({ file: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12, chunkId: "chunk-1" }, retrieved)
    ).toBe(true);
  });

  it("rejects a citation for a chunk id not in the retrieved set (hallucinated)", () => {
    expect(
      validateCitation({ file: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12, chunkId: "chunk-99" }, retrieved)
    ).toBe(false);
  });

  it("rejects a citation whose line range doesn't match the retrieved chunk", () => {
    expect(
      validateCitation({ file: "src/auth/handleAuthError.ts", startLine: 1, endLine: 999, chunkId: "chunk-1" }, retrieved)
    ).toBe(false);
  });

  it("rejects a citation for the wrong file", () => {
    expect(
      validateCitation({ file: "src/other.ts", startLine: 1, endLine: 12, chunkId: "chunk-1" }, retrieved)
    ).toBe(false);
  });
});
