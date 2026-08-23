import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { runPrReview, processPrReviewJob } from "./pr-review.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";
import * as llmService from "../../chat/services/llm.service.js";
import * as retrievalService from "../../retrieval/services/retrieval.service.js";
import * as dependencyRetrievalService from "./dependency-retrieval.service.js";
import * as githubDiffService from "./github-diff.service.js";
import * as githubWritebackService from "./github-writeback.service.js";
import * as githubAppService from "../../repositories/services/github-app.service.js";

describe("runPrReview", () => {
  let repositoryId: string;
  let pullRequestId: string;

  beforeEach(async () => {
    await prisma.usageLog.deleteMany();
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { githubId: BigInt(1), username: "octocat", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(1), permissions: {} },
    });
    const repository = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "octocat",
        name: "hello-world",
        githubUrl: "https://github.com/octocat/hello-world",
        defaultBranch: "main",
      },
    });
    repositoryId = repository.id;
    await processFixtureIndexJob(repositoryId);

    const pr = await prisma.pullRequest.create({
      data: {
        repositoryId,
        githubPrNumber: 1,
        title: "Fix auth error handling",
        author: "octocat",
        baseSha: "base123",
        headSha: "head456",
      },
    });
    pullRequestId = pr.id;
  });

  afterAll(async () => {
    await prisma.usageLog.deleteMany();
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("produces a pr_reviews row with a risk score, breakdown, and findings", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: JSON.stringify([
        {
          category: "BUG",
          file: "src/auth/handleAuthError.ts",
          line: 3,
          explanation: "Does not handle network errors distinctly.",
          relatedSymbol: "handleAuthError",
          citationFile: "src/auth/handleAuthError.ts",
          citationStartLine: 1,
          citationEndLine: 12,
        },
      ]),
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const review = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    expect(review.status).toBe("COMPLETE");
    expect(review.riskScore).not.toBeNull();
    expect(review.riskFactors).not.toBeNull();
    expect(Array.isArray(review.findings)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((review.findings as any[])[0].category).toBe("BUG");
  });

  it("sends the actual source content of the changed chunk to the LLM even when retrieval finds nothing else relevant", async () => {
    // Regression: contextBlock used to render changedChunks/dependencies
    // (ChunkRef[], which has no `content` field) as a bare "path: symbol"
    // label, and relied entirely on retrieveContext's generic hybrid
    // search to coincidentally re-find the same chunk with real content.
    // Mocking retrieveContext to return [] (as it legitimately can on a
    // real repo when nothing else is lexically/semantically similar)
    // isolates whether the changed chunk's own content is sent
    // independently of what retrieval happens to find.
    vi.spyOn(retrievalService, "retrieveContext").mockResolvedValue([]);
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    const generateChatCompletionSpy = vi
      .spyOn(llmService, "generateChatCompletion")
      .mockResolvedValue({ text: JSON.stringify([]), usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 } });

    await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    // No afterEach(() => vi.restoreAllMocks()) in this file — mock.calls
    // accumulates across every test's spyOn of the same export, so index
    // [0] would flakily read an earlier test's call once this test runs
    // as part of the full file rather than in isolation. The last call is
    // always the one this test's own runPrReview invocation just made.
    const calls = generateChatCompletionSpy.mock.calls;
    const userPrompt = calls[calls.length - 1]?.[1] as string;
    // Real content of the fixture's handleAuthError chunk (sample-chunks.ts) —
    // must appear verbatim, not just the bare "src/auth/handleAuthError.ts: handleAuthError" label.
    expect(userPrompt).toContain("TokenExpiredError");
  });

  it("resolves a citation against the changed chunk itself, not only against retrieved chunks", async () => {
    // Regression: chunkByFileAndLines (used to resolve/validate a
    // finding's citation) was built only from `retrieved` — a finding
    // that correctly cites the actual changed file/lines got citation:
    // null unless retrieveContext ALSO coincidentally re-found that same
    // chunk, silently degrading citation quality for exactly the content
    // fix #1 made sure the LLM would see and cite.
    vi.spyOn(retrievalService, "retrieveContext").mockResolvedValue([]);
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: JSON.stringify([
        {
          category: "BUG",
          file: "src/auth/handleAuthError.ts",
          line: 3,
          explanation: "Does not distinguish network errors.",
          relatedSymbol: "handleAuthError",
          citationFile: "src/auth/handleAuthError.ts",
          citationStartLine: 1,
          citationEndLine: 12,
        },
      ]),
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const review = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finding = (review.findings as any[])[0];
    expect(finding.citation).not.toBeNull();
    expect(finding.citation.file).toBe("src/auth/handleAuthError.ts");
  });

  it("tells the LLM when a changed symbol has no test coverage, so it can actually report a TESTING finding", async () => {
    // Regression: hasTestCoverage (dependency-retrieval.service.ts) is
    // real and already wired into the numeric risk score, but was never
    // surfaced to the LLM prompt at all — the reviewer had no way to know
    // whether tests existed for a changed symbol, so it could never
    // produce a real "missing test coverage" finding regardless of how
    // good the prompt or context was.
    vi.spyOn(retrievalService, "retrieveContext").mockResolvedValue([]);
    vi.spyOn(dependencyRetrievalService, "hasTestCoverage").mockResolvedValue(false);
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    const generateChatCompletionSpy = vi
      .spyOn(llmService, "generateChatCompletion")
      .mockResolvedValue({ text: JSON.stringify([]), usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 } });

    await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    const calls = generateChatCompletionSpy.mock.calls;
    const userPrompt = calls[calls.length - 1]?.[1] as string;
    expect(userPrompt).toContain("handleAuthError");
    expect(userPrompt.toLowerCase()).toContain("no test file found");
  });

  it("labels the changed code separately from retrieved background context, so the LLM can tell them apart", async () => {
    // Regression (found via the eval harness): even after the changed
    // chunk's real content was included, unrelated files pulled in by
    // retrieveContext (as generic hybrid-search "related" results) were
    // concatenated into the SAME undifferentiated block with the same
    // formatting — the LLM sometimes reviewed the unrelated retrieved
    // file's content instead of the actual diff, with no structural
    // signal telling it which one was the real change.
    vi.spyOn(retrievalService, "retrieveContext").mockResolvedValue([
      {
        id: "unrelated-chunk-id",
        repositoryId: "unused",
        fileId: "unused",
        symbol: "unrelatedFunction",
        symbolType: "FUNCTION",
        parentSymbol: null,
        language: "typescript",
        startLine: 1,
        endLine: 3,
        content: "function unrelatedFunction() { return 'nothing to do with the diff'; }",
        filePath: "src/unrelated/Other.ts",
      },
    ]);
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    const generateChatCompletionSpy = vi
      .spyOn(llmService, "generateChatCompletion")
      .mockResolvedValue({ text: JSON.stringify([]), usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 } });

    await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    // No afterEach(() => vi.restoreAllMocks()) in this file — mock.calls
    // accumulates across every test's spyOn of the same export, so index
    // [0] would flakily read an earlier test's call once this test runs
    // as part of the full file rather than in isolation. The last call is
    // always the one this test's own runPrReview invocation just made.
    const calls = generateChatCompletionSpy.mock.calls;
    const userPrompt = calls[calls.length - 1]?.[1] as string;
    const changedHeaderIndex = userPrompt.indexOf("CHANGED CODE");
    const relatedHeaderIndex = userPrompt.indexOf("RELATED CONTEXT");
    const changedContentIndex = userPrompt.indexOf("TokenExpiredError");
    const unrelatedContentIndex = userPrompt.indexOf("unrelatedFunction() { return");

    expect(changedHeaderIndex).toBeGreaterThanOrEqual(0);
    expect(relatedHeaderIndex).toBeGreaterThan(changedHeaderIndex);
    // The changed chunk's real content must sit under the CHANGED CODE
    // header, and the unrelated retrieved chunk under RELATED CONTEXT —
    // not both jumbled together in one undifferentiated block.
    expect(changedContentIndex).toBeGreaterThan(changedHeaderIndex);
    expect(changedContentIndex).toBeLessThan(relatedHeaderIndex);
    expect(unrelatedContentIndex).toBeGreaterThan(relatedHeaderIndex);
  });

  it("does not throw when the LLM wraps its JSON reply in a markdown code fence", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: "```json\n" +
        JSON.stringify([
          {
            category: "BUG",
            file: "src/auth/handleAuthError.ts",
            line: 3,
            explanation: "fenced response",
            relatedSymbol: "handleAuthError",
            citationFile: "src/auth/handleAuthError.ts",
            citationStartLine: 1,
            citationEndLine: 12,
          },
        ]) +
        "\n```",
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const review = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    expect(review.status).toBe("COMPLETE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((review.findings as any[])[0].category).toBe("BUG");
  });

  it("saves zero findings instead of throwing when the LLM reply is not valid JSON", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: "I could not find any issues in this PR.",
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const review = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    expect(review.status).toBe("COMPLETE");
    expect(review.findings).toEqual([]);
  });

  it("returns the existing COMPLETE review instead of throwing when called twice for the same pullRequestId+commitSha (e.g. re-running an eval scenario)", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    const generateChatCompletionSpy = vi
      .spyOn(llmService, "generateChatCompletion")
      .mockResolvedValue({
        text: JSON.stringify([]),
        usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
      });

    const first = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);
    generateChatCompletionSpy.mockClear();

    const second = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    expect(second.id).toBe(first.id);
    expect(second.status).toBe("COMPLETE");
    expect(generateChatCompletionSpy).not.toHaveBeenCalled();

    const allReviews = await prisma.prReview.findMany({ where: { pullRequestId } });
    expect(allReviews).toHaveLength(1);
  });
});

describe("processPrReviewJob", () => {
  let repositoryId: string;
  let pullRequestId: string;

  beforeEach(async () => {
    await prisma.usageLog.deleteMany();
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { githubId: BigInt(2), username: "octocat2", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(2), permissions: {} },
    });
    const repository = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "octocat",
        name: "hello-world",
        githubUrl: "https://github.com/octocat/hello-world",
        defaultBranch: "main",
      },
    });
    repositoryId = repository.id;
    await processFixtureIndexJob(repositoryId);

    const pr = await prisma.pullRequest.create({
      data: {
        repositoryId,
        githubPrNumber: 7,
        title: "Fix auth error handling",
        author: "octocat",
        baseSha: "base123",
        headSha: "head456",
      },
    });
    pullRequestId = pr.id;
  });

  afterAll(async () => {
    await prisma.usageLog.deleteMany();
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("fetches the real diff, runs the review, and posts write-back to GitHub", async () => {
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "fake-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubDiffService, "getPrDiff").mockResolvedValue({
      changedRanges: [{ filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 }],
      positionByFileAndLine: new Map([["src/auth/handleAuthError.ts", new Map([[1, 4]])]]),
    });
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: JSON.stringify([
        {
          category: "BUG",
          file: "src/auth/handleAuthError.ts",
          line: 3,
          explanation: "Does not handle network errors distinctly.",
          relatedSymbol: "handleAuthError",
          citationFile: "src/auth/handleAuthError.ts",
          citationStartLine: 1,
          citationEndLine: 12,
        },
      ]),
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });
    const writebackSpy = vi
      .spyOn(githubWritebackService, "postReviewToGitHub")
      .mockResolvedValue({ posted: true });

    await processPrReviewJob({
      jobId: "job-1",
      pullRequestId,
      repositoryId,
      commitSha: "head456",
    });

    expect(writebackSpy).toHaveBeenCalledTimes(1);
    const savedReview = await prisma.prReview.findFirst({ where: { pullRequestId } });
    expect(savedReview?.status).toBe("COMPLETE");
    expect(savedReview?.writebackFailedAt).toBeNull();
    expect(Number(savedReview?.llmCostUsd)).toBeGreaterThan(0);

    const usageLogs = await prisma.usageLog.findMany({ where: { kind: "PR_REVIEW" } });
    expect(usageLogs).toHaveLength(1);
    expect(usageLogs[0]?.tokensUsed).toBe(150);
    expect(Number(usageLogs[0]?.costUsd)).toBeGreaterThan(0);
    expect(usageLogs[0]?.jobId).toBe("job-1");
  });

  it("marks writebackFailedAt without losing the saved review when GitHub rejects the write-back", async () => {
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "fake-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubDiffService, "getPrDiff").mockResolvedValue({
      changedRanges: [{ filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 }],
      positionByFileAndLine: new Map(),
    });
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: JSON.stringify([]),
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });
    vi.spyOn(githubWritebackService, "postReviewToGitHub").mockResolvedValue({
      posted: false,
      error: "status 422: stale diff",
    });

    await processPrReviewJob({
      jobId: "job-2",
      pullRequestId,
      repositoryId,
      commitSha: "head456",
    });

    const savedReview = await prisma.prReview.findFirst({ where: { pullRequestId } });
    expect(savedReview?.status).toBe("COMPLETE");
    expect(savedReview?.writebackFailedAt).not.toBeNull();
  });

  it("skips the job without duplicating work when a review for this commit already exists and is COMPLETE", async () => {
    const completed = await prisma.prReview.create({
      data: { pullRequestId, commitSha: "head456", status: "COMPLETE", riskScore: 10, riskLevel: "LOW" },
    });
    const generateChatCompletionSpy = vi.spyOn(llmService, "generateChatCompletion");
    generateChatCompletionSpy.mockClear();

    await processPrReviewJob({
      jobId: "job-3",
      pullRequestId,
      repositoryId,
      commitSha: "head456",
    });

    expect(generateChatCompletionSpy).not.toHaveBeenCalled();
    const allReviews = await prisma.prReview.findMany({ where: { pullRequestId } });
    expect(allReviews).toHaveLength(1);
    expect(allReviews[0]?.id).toBe(completed.id);
  });

  it("takes over and actually retries a leftover RUNNING row from a prior attempt, instead of silently no-op'ing (BullMQ would read that no-op as job success and never retry again)", async () => {
    // A RUNNING row already exists — e.g. left behind by an earlier
    // attempt of this exact BullMQ job that threw partway through.
    // BullMQ locks a jobId while processing it, so no two executions of
    // the SAME job ever run concurrently — the row here must be this
    // job's own leftover, and the retry must be allowed to redo the
    // work for real, not just return successfully having done nothing.
    const leftover = await prisma.prReview.create({
      data: { pullRequestId, commitSha: "head456", status: "RUNNING" },
    });

    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "fake-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubDiffService, "getPrDiff").mockResolvedValue({
      changedRanges: [{ filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 }],
      positionByFileAndLine: new Map(),
    });
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    const generateChatCompletionSpy = vi
      .spyOn(llmService, "generateChatCompletion")
      .mockResolvedValue({
        text: JSON.stringify([]),
        usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
      });
    generateChatCompletionSpy.mockClear();
    vi.spyOn(githubWritebackService, "postReviewToGitHub").mockResolvedValue({ posted: true });

    await processPrReviewJob({
      jobId: "job-4",
      pullRequestId,
      repositoryId,
      commitSha: "head456",
    });

    expect(generateChatCompletionSpy).toHaveBeenCalledTimes(1);
    const allReviews = await prisma.prReview.findMany({ where: { pullRequestId } });
    expect(allReviews).toHaveLength(1);
    expect(allReviews[0]?.id).toBe(leftover.id);
    expect(allReviews[0]?.status).toBe("COMPLETE");
  });

  it("marks the review FAILED with the real error and rethrows when the pipeline itself throws (not just write-back), instead of leaving the row stuck at RUNNING forever", async () => {
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "fake-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubDiffService, "getPrDiff").mockResolvedValue({
      changedRanges: [{ filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 }],
      positionByFileAndLine: new Map(),
    });
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockRejectedValue(
      new Error("The AI service is temporarily unavailable. Please try again in a moment.")
    );

    await expect(
      processPrReviewJob({ jobId: "job-5", pullRequestId, repositoryId, commitSha: "head456" })
    ).rejects.toThrow("temporarily unavailable");

    const savedReview = await prisma.prReview.findFirst({ where: { pullRequestId } });
    expect(savedReview?.status).toBe("FAILED");
    expect(savedReview?.failureReason).toContain("temporarily unavailable");
  });

  it("recovers on a real BullMQ retry after a FAILED attempt, ending COMPLETE instead of stuck FAILED forever", async () => {
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "fake-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubDiffService, "getPrDiff").mockResolvedValue({
      changedRanges: [{ filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 }],
      positionByFileAndLine: new Map(),
    });
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(githubWritebackService, "postReviewToGitHub").mockResolvedValue({ posted: true });

    const generateChatCompletionSpy = vi.spyOn(llmService, "generateChatCompletion");
    generateChatCompletionSpy.mockRejectedValueOnce(new Error("503 UNAVAILABLE"));
    generateChatCompletionSpy.mockResolvedValueOnce({
      text: JSON.stringify([]),
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const payload = { jobId: "job-6", pullRequestId, repositoryId, commitSha: "head456" };
    await expect(processPrReviewJob(payload)).rejects.toThrow("503 UNAVAILABLE");
    await processPrReviewJob(payload); // BullMQ's own retry, same jobId

    const allReviews = await prisma.prReview.findMany({ where: { pullRequestId } });
    expect(allReviews).toHaveLength(1);
    expect(allReviews[0]?.status).toBe("COMPLETE");
  });
});
