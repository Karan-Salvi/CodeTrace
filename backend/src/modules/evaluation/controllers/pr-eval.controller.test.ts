import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";
import * as llmService from "../../chat/services/llm.service.js";

describe("POST /evaluation/pr-run", () => {
  const app = createApp();
  let repositoryId: string;
  let pullRequestId: string;
  let token: string;

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

    token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });
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

  it("scores true/false positives against labeled issues and returns precision/recall", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue(
      JSON.stringify([
        {
          category: "BUG",
          file: "src/auth/handleAuthError.ts",
          line: 3,
          explanation: "Missing network error handling.",
          relatedSymbol: "handleAuthError",
          citationFile: "src/auth/handleAuthError.ts",
          citationStartLine: 1,
          citationEndLine: 12,
        },
      ])
    );

    const res = await request(app)
      .post("/evaluation/pr-run")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pullRequestId,
        changedRanges: [{ filePath: "src/auth/handleAuthError.ts", startLine: 1, endLine: 12 }],
        labeledIssues: [{ category: "BUG", file: "src/auth/handleAuthError.ts" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.truePositives).toBe(1);
    expect(res.body.data.falsePositives).toBe(0);
    expect(res.body.data.falseNegatives).toBe(0);
    expect(res.body.data.precision).toBe(1);
    expect(res.body.data.recall).toBe(1);
  });
});
