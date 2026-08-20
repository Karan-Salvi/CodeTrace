import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { runPrReview, processPrReviewJob } from "./pr-review.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";
import * as llmService from "../../chat/services/llm.service.js";
import * as githubDiffService from "./github-diff.service.js";
import * as githubWritebackService from "./github-writeback.service.js";
import * as githubAppService from "../../repositories/services/github-app.service.js";

describe("runPrReview", () => {
  let repositoryId: string;
  let pullRequestId: string;

  beforeEach(async () => {
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
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue(
      JSON.stringify([
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
      ])
    );

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

  it("does not throw when the LLM wraps its JSON reply in a markdown code fence", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue(
      "```json\n" +
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
        "\n```"
    );

    const review = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    expect(review.status).toBe("COMPLETE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((review.findings as any[])[0].category).toBe("BUG");
  });

  it("saves zero findings instead of throwing when the LLM reply is not valid JSON", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue(
      "I could not find any issues in this PR."
    );

    const review = await runPrReview(pullRequestId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 },
    ]);

    expect(review.status).toBe("COMPLETE");
    expect(review.findings).toEqual([]);
  });
});

describe("processPrReviewJob", () => {
  let repositoryId: string;
  let pullRequestId: string;

  beforeEach(async () => {
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
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue(
      JSON.stringify([
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
      ])
    );
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
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue(JSON.stringify([]));
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

  it("skips rather than duplicates when the pullRequestId+commitSha unique constraint rejects a concurrent create (two jobs racing the same commit)", async () => {
    // Simulates the real race the DB unique constraint exists to close:
    // a second job for this exact commit (duplicate webhook delivery, or
    // a genuinely concurrent worker slot under concurrency:5) finds a
    // RUNNING row already owned by another in-flight attempt.
    const inFlight = await prisma.prReview.create({
      data: { pullRequestId, commitSha: "head456", status: "RUNNING" },
    });
    const generateChatCompletionSpy = vi.spyOn(llmService, "generateChatCompletion");
    generateChatCompletionSpy.mockClear();

    await processPrReviewJob({
      jobId: "job-4",
      pullRequestId,
      repositoryId,
      commitSha: "head456",
    });

    expect(generateChatCompletionSpy).not.toHaveBeenCalled();
    const allReviews = await prisma.prReview.findMany({ where: { pullRequestId } });
    expect(allReviews).toHaveLength(1);
    expect(allReviews[0]?.id).toBe(inFlight.id);
    expect(allReviews[0]?.status).toBe("RUNNING");
  });
});
