import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import * as indexJobProducer from "../../../queues/producers/index-job.producer.js";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex");
}

describe("POST /webhooks/github", () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.webhookEvent.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects an unsigned request", async () => {
    const res = await request(app)
      .post("/webhooks/github")
      .set("x-github-event", "push")
      .set("x-github-delivery", "evt-unsigned")
      .send({ after: "abc" });
    expect(res.status).toBe(401);
  });

  it("processes a signed push event and enqueues an index job", async () => {
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);

    const user = await prisma.user.create({
      data: { githubId: BigInt(1), username: "octocat", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(42), permissions: {} },
    });
    const repo = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "octocat",
        name: "hello-world",
        githubUrl: "https://github.com/octocat/hello-world",
        defaultBranch: "main",
        status: "INDEXED",
      },
    });

    const body = JSON.stringify({
      after: "newsha123",
      repository: { full_name: "octocat/hello-world", id: 1 },
      installation: { id: 42 },
    });

    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("x-github-event", "push")
      .set("x-github-delivery", "evt-push-1")
      .set("x-hub-signature-256", sign(body))
      .send(body);

    expect(res.status).toBe(200);
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: repo.id, type: "INCREMENTAL" })
    );

    const event = await prisma.webhookEvent.findUnique({ where: { eventId: "evt-push-1" } });
    expect(event).not.toBeNull();
  });

  it("a duplicate delivery of the same event_id is a no-op", async () => {
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();

    const user = await prisma.user.create({
      data: { githubId: BigInt(2), username: "octocat2", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(43), permissions: {} },
    });
    await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "octocat2",
        name: "repo2",
        githubUrl: "https://github.com/octocat2/repo2",
        defaultBranch: "main",
        status: "INDEXED",
      },
    });

    const body = JSON.stringify({
      after: "sha1",
      repository: { full_name: "octocat2/repo2", id: 2 },
      installation: { id: 43 },
    });
    const headers = {
      "Content-Type": "application/json",
      "x-github-event": "push",
      "x-github-delivery": "evt-dup-1",
      "x-hub-signature-256": sign(body),
    };

    await request(app).post("/webhooks/github").set(headers).send(body);
    await request(app).post("/webhooks/github").set(headers).send(body);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  it("concurrent duplicate deliveries of the same event_id only enqueue once", async () => {
    // Regression: isEventProcessed()+markEventProcessed() used to be a
    // check-then-act race — two concurrent requests for the same
    // event_id could both pass the "not processed" check before either
    // marked it, both dispatching the handler (duplicate INCREMENTAL
    // index enqueue). tryClaimEvent's DB-level unique-constraint insert
    // closes that window; sequential requests (the pre-existing test
    // above) don't exercise it at all since the first completes before
    // the second starts.
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();

    const user = await prisma.user.create({
      data: { githubId: BigInt(99), username: "racer", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(99), permissions: {} },
    });
    await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "racer",
        name: "repo",
        githubUrl: "https://github.com/racer/repo",
        defaultBranch: "main",
        status: "INDEXED",
      },
    });

    const body = JSON.stringify({
      after: "sha1",
      repository: { full_name: "racer/repo", id: 99 },
      installation: { id: 99 },
    });
    const headers = {
      "Content-Type": "application/json",
      "x-github-event": "push",
      "x-github-delivery": "evt-race-1",
      "x-hub-signature-256": sign(body),
    };

    await Promise.all([
      request(app).post("/webhooks/github").set(headers).send(body),
      request(app).post("/webhooks/github").set(headers).send(body),
    ]);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  it("processes an installation deleted event by revoking the installation", async () => {
    const user = await prisma.user.create({
      data: { githubId: BigInt(3), username: "octocat3", githubAccessToken: "enc" },
    });
    await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(44), permissions: {} },
    });

    const body = JSON.stringify({ action: "deleted", installation: { id: 44 } });
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("x-github-event", "installation")
      .set("x-github-delivery", "evt-install-1")
      .set("x-hub-signature-256", sign(body))
      .send(body);

    expect(res.status).toBe(200);
    const installation = await prisma.repositoryInstallation.findFirst({
      where: { githubInstallationId: BigInt(44) },
    });
    expect(installation?.revokedAt).not.toBeNull();
  });
});
