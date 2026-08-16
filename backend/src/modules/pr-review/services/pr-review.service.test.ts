import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { runPrReview } from "./pr-review.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";
import * as llmService from "../../chat/services/llm.service.js";

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
});
