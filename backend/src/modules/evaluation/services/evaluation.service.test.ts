import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../../../database/client.js";
import { runRetrievalEval } from "./evaluation.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";
import * as rerankerService from "../../retrieval/services/reranker.service.js";

describe("runRetrievalEval", () => {
  let repositoryId: string;

  beforeEach(async () => {
    await prisma.evalResult.deleteMany();
    await prisma.evalRun.deleteMany();
    await prisma.evalQuestion.deleteMany();
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

    await prisma.evalQuestion.create({
      data: {
        repositoryId,
        question: "handleAuthError",
        expectedChunks: [{ path: "src/auth/handleAuthError.ts", symbol: "handleAuthError" }],
      },
    });
  });

  afterAll(async () => {
    await prisma.evalResult.deleteMany();
    await prisma.evalRun.deleteMany();
    await prisma.evalQuestion.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("HYBRID_RERANKED calls the reranker and can reorder results differently than HYBRID", async () => {
    // Second question so there's more than one candidate to reorder.
    await prisma.evalQuestion.create({
      data: {
        repositoryId,
        question: "login",
        expectedChunks: [{ path: "src/auth/AuthService.ts", symbol: "login" }],
      },
    });

    const rerankSpy = vi.spyOn(rerankerService, "rerank");

    await runRetrievalEval(repositoryId, "HYBRID_RERANKED");

    expect(rerankSpy).toHaveBeenCalled();
    rerankSpy.mockRestore();

    const plainHybridSpy = vi.spyOn(rerankerService, "rerank");
    await runRetrievalEval(repositoryId, "HYBRID");
    expect(plainHybridSpy).not.toHaveBeenCalled();
    plainHybridSpy.mockRestore();
  });

  it("scores a KEYWORD_ONLY run and writes real (not estimated) metrics", async () => {
    const run = await runRetrievalEval(repositoryId, "KEYWORD_ONLY");

    expect(run.config).toBe("KEYWORD_ONLY");
    expect(run.recallAt5).toBeGreaterThan(0);
    expect(run.precisionAt5).toBeGreaterThanOrEqual(0);
    expect(run.mrr).toBeGreaterThan(0);

    const results = await prisma.evalResult.findMany({ where: { evalRunId: run.id } });
    expect(results).toHaveLength(1);
    expect(results[0].correct).toBe(true);
  });

  it("refuses to score a repository with zero eval questions instead of writing fabricated zeros", async () => {
    // evaluation.md / CLAUDE.md: "Only measured numbers go in docs/README
    // — never estimates." `totalQuestions = questions.length || 1` used to
    // silently divide by a fake 1 when there were zero questions, writing
    // recallAt5/precisionAt5/mrr all as 0.0 — indistinguishable from "the
    // retrieval system found nothing" even though no evaluation actually
    // ran. That's a fabricated number, not a measured one.
    await prisma.evalQuestion.deleteMany({ where: { repositoryId } });

    await expect(runRetrievalEval(repositoryId, "KEYWORD_ONLY")).rejects.toThrow(/no eval question/i);

    const runs = await prisma.evalRun.findMany({ where: { repositoryId } });
    expect(runs).toHaveLength(0);
  });
});
