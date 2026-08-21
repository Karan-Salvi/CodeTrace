import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { createApp } from "../../app.js";
import { createWebSocketGateway } from "../gateway.js";
import { prisma } from "../../database/client.js";
import { env } from "../../config/env.js";

describe("pr-review-progress websocket handler", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let pullRequestId: string;
  let token: string;

  beforeEach(async () => {
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
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
    const pullRequest = await prisma.pullRequest.create({
      data: {
        repositoryId: repository.id,
        githubPrNumber: 1,
        title: "Fix bug",
        author: "octocat",
        baseSha: "base123",
        headSha: "head456",
      },
    });
    pullRequestId = pullRequest.id;

    token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });

    const app = createApp();
    server = createServer(app);
    createWebSocketGateway(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server?.close();
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects a subscription with an invalid token", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const received = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-pr-review-progress", pullRequestId, token: "bad" }));
      });
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });
    expect(received.type).toBe("error");
    ws.close();
  });

  it("rejects a subscription for a pull request whose repository the caller does not own", async () => {
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other", githubAccessToken: "enc" },
    });
    const otherToken = jwt.sign({ userId: otherUser.id, sessionId: "s2" }, env.JWT_ACCESS_SECRET, {
      expiresIn: 900,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const received = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-pr-review-progress", pullRequestId, token: otherToken }));
      });
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });
    expect(received.type).toBe("error");
    ws.close();
  });

  it("pushes progress updates as the review's status changes and stops at COMPLETE", async () => {
    await prisma.prReview.create({
      data: { pullRequestId, commitSha: "head456", status: "RUNNING" },
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages: Record<string, unknown>[] = [];

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-pr-review-progress", pullRequestId, token }));
      });
      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);

        if (messages.length === 1) {
          await prisma.prReview.updateMany({
            where: { pullRequestId },
            data: { status: "COMPLETE", riskScore: 42, riskLevel: "MEDIUM" },
          });
        }

        if (msg.type === "pr-review-progress-complete") {
          resolve();
        }
      });
    });

    ws.close();

    const progressMessages = messages.filter((m) => m.type === "pr-review-progress");
    expect(progressMessages[0].status).toBe("RUNNING");
    expect(progressMessages.some((m) => m.status === "COMPLETE" && m.riskScore === 42)).toBe(true);
    expect(messages[messages.length - 1].type).toBe("pr-review-progress-complete");
  }, 15000);
});
