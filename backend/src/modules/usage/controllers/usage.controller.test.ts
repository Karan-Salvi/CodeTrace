import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../../config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../config/env.js")>();
  return { env: { ...actual.env, OPERATOR_USER_ID: "will-be-set-per-test" } };
});

import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";

describe("GET /usage/summary", () => {
  const app = createApp();
  let operatorToken: string;
  let otherToken: string;
  let repositoryId: string;

  beforeEach(async () => {
    await prisma.usageLog.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();

    const operator = await prisma.user.create({
      data: { githubId: BigInt(1), username: "operator", githubAccessToken: "enc" },
    });
    const other = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other", githubAccessToken: "enc" },
    });
    env.OPERATOR_USER_ID = operator.id;

    const installation = await prisma.repositoryInstallation.create({
      data: { userId: operator.id, githubInstallationId: BigInt(1), permissions: {} },
    });
    const repository = await prisma.repository.create({
      data: {
        userId: operator.id,
        installationId: installation.id,
        owner: "octocat",
        name: "hello-world",
        githubUrl: "https://github.com/octocat/hello-world",
        defaultBranch: "main",
      },
    });
    repositoryId = repository.id;

    await prisma.usageLog.create({
      data: { repositoryId, requestId: "r1", kind: "QA", tokensUsed: 100, costUsd: 0.01 },
    });
    await prisma.usageLog.create({
      data: { repositoryId, requestId: "r2", kind: "PR_REVIEW", tokensUsed: 200, costUsd: 0.02 },
    });

    operatorToken = jwt.sign({ userId: operator.id, sessionId: "s1" }, process.env.JWT_ACCESS_SECRET!, { expiresIn: 900 });
    otherToken = jwt.sign({ userId: other.id, sessionId: "s2" }, process.env.JWT_ACCESS_SECRET!, { expiresIn: 900 });
  });

  afterAll(async () => {
    await prisma.usageLog.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("requires auth", async () => {
    const res = await request(app).get("/usage/summary");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-operator", async () => {
    const res = await request(app).get("/usage/summary").set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it("returns aggregated totals for the operator", async () => {
    const res = await request(app).get("/usage/summary").set("Authorization", `Bearer ${operatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totals.calls).toBe(2);
    expect(res.body.data.totals.byKind.QA.calls).toBe(1);
    expect(res.body.data.totals.byKind.PR_REVIEW.calls).toBe(1);
    expect(Number(res.body.data.totals.costUsd)).toBeCloseTo(0.03, 6);
  });

  it("includes the repository in topRepositories with owner/name", async () => {
    const res = await request(app).get("/usage/summary").set("Authorization", `Bearer ${operatorToken}`);
    expect(res.body.data.topRepositories[0]).toMatchObject({ repositoryId, owner: "octocat", name: "hello-world" });
  });

  it("rejects an invalid days value", async () => {
    const res = await request(app).get("/usage/summary?days=14").set("Authorization", `Bearer ${operatorToken}`);
    expect(res.status).toBe(400);
  });
});
