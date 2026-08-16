import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";

// Mock the queue producer
vi.mock("../../../queues/producers/index-job.producer.js", () => ({
  enqueueIndexJob: vi.fn().mockResolvedValue(undefined),
}));
import { enqueueIndexJob } from "../../../queues/producers/index-job.producer.js";

async function makeAuthedUser() {
  const user = await prisma.user.create({
    data: { githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)), username: "indexer", githubAccessToken: "enc" },
  });
  const token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });
  return { user, token };
}

describe("indexing routes", () => {
  const app = createApp();

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.indexJob.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.indexJob.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("POST /repositories/:id/index requires auth", async () => {
    const res = await request(app).post("/repositories/some-uuid/index").send();
    expect(res.status).toBe(401);
  });

  it("POST /repositories/:id/index returns 404 for a not-owned repository", async () => {
    const { token } = await makeAuthedUser();
    
    // Create a repo owned by someone else
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(999), username: "other", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: otherUser.id, githubInstallationId: BigInt(2), permissions: {} },
    });
    const repo = await prisma.repository.create({
      data: {
        userId: otherUser.id,
        installationId: installation.id,
        owner: "other",
        name: "repo",
        githubUrl: "https://github.com/other/repo",
        defaultBranch: "main",
        status: "INDEXED",
      },
    });

    const res = await request(app)
      .post(`/repositories/${repo.id}/index`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(404);
  });

  it("POST /repositories/:id/index returns 409 ALREADY_INDEXING if already indexing", async () => {
    const { user, token } = await makeAuthedUser();
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(3), permissions: {} },
    });
    const repo = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "indexer",
        name: "repo",
        githubUrl: "https://github.com/indexer/repo",
        defaultBranch: "main",
        status: "CLONING", // Non-terminal
      },
    });

    // Seed one existing job
    await prisma.indexJob.create({
      data: {
        repositoryId: repo.id,
        type: "FULL",
        status: "CLONING",
      },
    });

    const res = await request(app)
      .post(`/repositories/${repo.id}/index`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_INDEXING");

    // Ensure no second job was created
    const jobsCount = await prisma.indexJob.count();
    expect(jobsCount).toBe(1);

    // Ensure queue wasn't called
    expect(enqueueIndexJob).not.toHaveBeenCalled();
  });

  it("POST /repositories/:id/index enqueues a full index (happy path)", async () => {
    const { user, token } = await makeAuthedUser();
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(4), permissions: {} },
    });
    const repo = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "indexer",
        name: "repo",
        githubUrl: "https://github.com/indexer/repo-happy",
        defaultBranch: "main",
        status: "FAILED", // Terminal, allows re-index
      },
    });

    const res = await request(app)
      .post(`/repositories/${repo.id}/index`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(202);
    
    // Check IndexJob row
    const jobs = await prisma.indexJob.findMany({ where: { repositoryId: repo.id } });
    expect(jobs).toHaveLength(1);
    const indexJob = jobs[0];
    expect(indexJob.status).toBe("PENDING");
    expect(indexJob.type).toBe("FULL");

    // Check Repository status
    const updatedRepo = await prisma.repository.findUnique({ where: { id: repo.id } });
    expect(updatedRepo?.status).toBe("PENDING");

    // Check queue was called
    expect(enqueueIndexJob).toHaveBeenCalledTimes(1);
    expect(enqueueIndexJob).toHaveBeenCalledWith({
      jobId: indexJob.id,
      repositoryId: repo.id,
      type: "FULL",
    });
  });

  it("POST /repositories/:id/index rejects a second concurrent trigger instead of double-indexing", async () => {
    // Regression: triggerFullIndex reads repository.status, checks it,
    // THEN runs a separate $transaction that writes PENDING — those two
    // steps are not atomic with each other. Two concurrent requests can
    // both read the same terminal status (e.g. FAILED) before either
    // commits its write, both pass the ALREADY_INDEXING guard, and both
    // create an IndexJob row + enqueue a job for the same repository —
    // exactly the double-index / wasted-embedding-cost problem this
    // guard exists to prevent in the first place.
    const { user, token } = await makeAuthedUser();
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(5), permissions: {} },
    });
    const repo = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "indexer",
        name: "repo-race",
        githubUrl: "https://github.com/indexer/repo-race",
        defaultBranch: "main",
        status: "FAILED",
      },
    });

    const fire = () =>
      request(app).post(`/repositories/${repo.id}/index`).set("Authorization", `Bearer ${token}`).send();

    const [resA, resB] = await Promise.all([fire(), fire()]);
    const statuses = [resA.status, resB.status].sort();

    expect(statuses).toEqual([202, 409]);

    const jobs = await prisma.indexJob.findMany({ where: { repositoryId: repo.id } });
    expect(jobs).toHaveLength(1);
    expect(enqueueIndexJob).toHaveBeenCalledTimes(1);
  });
});
