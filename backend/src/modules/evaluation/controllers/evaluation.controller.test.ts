import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";

describe("POST /evaluation/retrieval-run", () => {
  const app = createApp();
  let repositoryId: string;
  let token: string;

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

    token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });
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

  it("requires auth", async () => {
    const res = await request(app).post("/evaluation/retrieval-run").send({ repositoryId, config: "KEYWORD_ONLY" });
    expect(res.status).toBe(401);
  });

  it("runs a retrieval eval and returns scored, non-estimated metrics", async () => {
    const res = await request(app)
      .post("/evaluation/retrieval-run")
      .set("Authorization", `Bearer ${token}`)
      .send({ repositoryId, config: "KEYWORD_ONLY" });

    expect(res.status).toBe(200);
    expect(res.body.data.config).toBe("KEYWORD_ONLY");
    expect(typeof res.body.data.recallAt5).toBe("number");
  });

  it("rejects a request for a repository the caller does not own", async () => {
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other", githubAccessToken: "enc" },
    });
    const otherInstallation = await prisma.repositoryInstallation.create({
      data: { userId: otherUser.id, githubInstallationId: BigInt(2), permissions: {} },
    });
    const otherRepo = await prisma.repository.create({
      data: {
        userId: otherUser.id,
        installationId: otherInstallation.id,
        owner: "other",
        name: "repo2",
        githubUrl: "https://github.com/other/repo2",
        defaultBranch: "main",
      },
    });

    const res = await request(app)
      .post("/evaluation/retrieval-run")
      .set("Authorization", `Bearer ${token}`)
      .send({ repositoryId: otherRepo.id, config: "KEYWORD_ONLY" });

    expect(res.status).toBe(404);
  });
});
