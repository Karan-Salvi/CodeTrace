import { describe, it, expect, vi } from "vitest";
import { postReviewToGitHub } from "./github-writeback.service.js";
import type { PrFinding, RiskFactor } from "../types/pr-review.types.js";

function baseFinding(overrides: Partial<PrFinding> = {}): PrFinding {
  return {
    category: "BUG",
    file: "src/foo.ts",
    line: 2,
    explanation: "does not handle null",
    relatedSymbol: "foo",
    citation: { file: "src/foo.ts", startLine: 2, endLine: 2, chunkId: "chunk-1" },
    ...overrides,
  };
}

describe("postReviewToGitHub", () => {
  it("routes a finding with a computable diff position to an inline comment", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    const positionByFileAndLine = new Map([["src/foo.ts", new Map([[2, 5]])]]);
    const riskFactors: RiskFactor[] = [{ code: "AUTH_PATH", points: 20, reason: "touches auth" }];

    const result = await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 20, riskLevel: "LOW", riskFactors, findings: [baseFinding()] },
      positionByFileAndLine
    );

    expect(result.posted).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/octocat/hello-world/pulls/42/reviews",
      expect.objectContaining({ method: "POST" })
    );
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.event).toBe("COMMENT");
    expect(callBody.comments).toEqual([
      { path: "src/foo.ts", position: 5, body: expect.stringContaining("does not handle null") },
    ]);

    vi.unstubAllGlobals();
  });

  it("anchors the inline comment on finding.line, not citation.startLine, since a citation chunk can span far more lines than the one flagged", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    // Citation spans a whole 40-line function chunk (startLine 10), but
    // the finding is actually about line 47 inside it. Only line 47 has
    // a known diff position — line 10 (the chunk's start) does not.
    const positionByFileAndLine = new Map([["src/foo.ts", new Map([[47, 9]])]]);
    const finding = baseFinding({
      line: 47,
      citation: { file: "src/foo.ts", startLine: 10, endLine: 50, chunkId: "chunk-1" },
    });

    const result = await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 20, riskLevel: "LOW", riskFactors: [], findings: [finding] },
      positionByFileAndLine
    );

    expect(result.posted).toBe(true);
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.comments).toEqual([
      { path: "src/foo.ts", position: 9, body: expect.stringContaining("does not handle null") },
    ]);

    vi.unstubAllGlobals();
  });

  it("routes to the summary instead of anchoring inline when the citation is a different file than the finding (a one-hop dependency chunk)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    // The finding is about src/service.ts:42, but its citation legitimately
    // points at supporting context in a different file, src/utils.ts. If
    // utils.ts's diff happens to have a position at line 42 too, the old
    // (pre-fix) code would post the comment on utils.ts describing a bug
    // that's actually in service.ts.
    const positionByFileAndLine = new Map([["src/utils.ts", new Map([[42, 7]])]]);
    const finding = baseFinding({
      file: "src/service.ts",
      line: 42,
      citation: { file: "src/utils.ts", startLine: 10, endLine: 15, chunkId: "chunk-2" },
    });

    const result = await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 20, riskLevel: "LOW", riskFactors: [], findings: [finding] },
      positionByFileAndLine
    );

    expect(result.posted).toBe(true);
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.comments).toEqual([]);
    expect(callBody.body).toContain("src/service.ts:42");

    vi.unstubAllGlobals();
  });

  it("routes to the summary instead of anchoring inline when finding.line falls outside the citation's own [startLine, endLine] range", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    const positionByFileAndLine = new Map([["src/foo.ts", new Map([[99, 3]])]]);
    const finding = baseFinding({
      file: "src/foo.ts",
      line: 99, // has a known position, but is outside the citation's own range
      citation: { file: "src/foo.ts", startLine: 10, endLine: 20, chunkId: "chunk-1" },
    });

    const result = await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 20, riskLevel: "LOW", riskFactors: [], findings: [finding] },
      positionByFileAndLine
    );

    expect(result.posted).toBe(true);
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.comments).toEqual([]);

    vi.unstubAllGlobals();
  });

  it("routes a finding with no computable diff position into the summary body instead of dropping it", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    const positionByFileAndLine = new Map<string, Map<number, number>>(); // empty — no file has a known position

    const result = await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 20, riskLevel: "LOW", riskFactors: [], findings: [baseFinding()] },
      positionByFileAndLine
    );

    expect(result.posted).toBe(true);
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.comments).toEqual([]);
    expect(callBody.body).toContain("does not handle null");
    expect(callBody.body).toContain("src/foo.ts:2");

    vi.unstubAllGlobals();
  });

  it("routes a finding with no citation into the summary body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 0, riskLevel: "LOW", riskFactors: [], findings: [baseFinding({ citation: null })] },
      new Map()
    );

    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.comments).toEqual([]);
    expect(callBody.body).toContain("does not handle null");

    vi.unstubAllGlobals();
  });

  it("always posts exactly one review call with event COMMENT, never REQUEST_CHANGES or APPROVE", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mockFetch);

    await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 90, riskLevel: "HIGH", riskFactors: [], findings: [] },
      new Map()
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.event).toBe("COMMENT");

    vi.unstubAllGlobals();
  });

  it("returns posted: false with the error message when GitHub rejects the review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ message: "Pull request diff not available" }),
      })
    );

    const result = await postReviewToGitHub(
      "token123",
      "octocat",
      "hello-world",
      42,
      { riskScore: 0, riskLevel: "LOW", riskFactors: [], findings: [] },
      new Map()
    );

    expect(result.posted).toBe(false);
    expect(result.error).toContain("Pull request diff not available");

    vi.unstubAllGlobals();
  });
});
