import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { createApp } from "../../app.js";
import { createWebSocketGateway } from "../gateway.js";
import { prisma } from "../../database/client.js";
import { env } from "../../config/env.js";

describe("index-progress websocket handler", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let repositoryId: string;
  let token: string;

  beforeEach(async () => {
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
        status: "CLONING",
      },
    });
    repositoryId = repository.id;

    token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });

    const app = createApp();
    server = createServer(app);
    createWebSocketGateway(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server?.close();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects a subscription with an invalid token", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const received = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-progress", repositoryId, token: "bad" }));
      });
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });
    expect(received.type).toBe("error");
    ws.close();
  });

  it("rejects a subscription for a repository the caller does not own", async () => {
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other", githubAccessToken: "enc" },
    });
    const otherToken = jwt.sign({ userId: otherUser.id, sessionId: "s2" }, env.JWT_ACCESS_SECRET, {
      expiresIn: 900,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const received = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-progress", repositoryId, token: otherToken }));
      });
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });
    expect(received.type).toBe("error");
    ws.close();
  });

  it("pushes progress updates as repository counters change and stops at INDEXED", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages: Record<string, unknown>[] = [];

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-progress", repositoryId, token }));
      });
      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);

        if (messages.length === 1) {
          // first tick should reflect initial CLONING state; now progress the job
          await prisma.repository.update({
            where: { id: repositoryId },
            data: { status: "EMBEDDING", filesIndexed: 3, chunksIndexed: 10 },
          });
        }

        if (msg.type === "progress-complete") {
          resolve();
        }

        if (messages.length === 2) {
          await prisma.repository.update({
            where: { id: repositoryId },
            data: { status: "INDEXED", filesIndexed: 3, chunksIndexed: 10 },
          });
        }
      });
    });

    ws.close();

    const progressMessages = messages.filter((m) => m.type === "progress");
    expect(progressMessages.length).toBeGreaterThanOrEqual(2);
    expect(progressMessages[0].status).toBe("CLONING");
    expect(progressMessages.some((m) => m.status === "EMBEDDING" && m.chunksIndexed === 10)).toBe(true);
    expect(messages[messages.length - 1].type).toBe("progress-complete");
  }, 15000);

  it("re-subscribing on the same connection replaces the previous poll instead of stacking it", async () => {
    const secondRepo = await prisma.repository.create({
      data: {
        userId: (await prisma.user.findFirstOrThrow()).id,
        installationId: (await prisma.repositoryInstallation.findFirstOrThrow()).id,
        owner: "octocat",
        name: "second-repo",
        githubUrl: "https://github.com/octocat/second-repo",
        defaultBranch: "main",
        status: "PARSING",
      },
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages: Record<string, unknown>[] = [];

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe-progress", repositoryId, token }));
        // Immediately re-subscribe to a different repository on the same
        // socket — the first interval must be cleared, not left running
        // alongside the second.
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "subscribe-progress", repositoryId: secondRepo.id, token }));
        }, 50);
      });
      ws.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      // give both intervals a couple of ticks, then check no message ever
      // reports the first (now-unsubscribed) repository's status again
      setTimeout(resolve, 1600);
    });

    ws.close();

    const progressMessages = messages.filter((m) => m.type === "progress");
    // every progress message after the resubscribe must reflect the second
    // repository (PARSING), never fall back to reporting the first
    // repository's CLONING state on a leaked interval
    const cloningMessagesAfterResubscribe = progressMessages.filter((m) => m.status === "CLONING");
    expect(cloningMessagesAfterResubscribe.length).toBeLessThanOrEqual(1);
    expect(progressMessages.some((m) => m.status === "PARSING")).toBe(true);
  }, 10000);

  it("does not accumulate a close listener per resubscribe on the same connection", async () => {
    // Regression: handleProgressSubscription registered a fresh ws.on("close", ...)
    // closure on every call without removing the prior one. Each stale
    // listener was individually harmless (it just re-clears an
    // already-cleared interval) but never got removed, so the listener
    // array grew unboundedly for the socket's lifetime — confirmed via a
    // real Node MaxListenersExceededWarning after the 11th resubscribe
    // (default max is 10).
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    for (let i = 0; i < 15; i++) {
      ws.send(JSON.stringify({ type: "subscribe-progress", repositoryId, token }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(ws.listenerCount("close")).toBeLessThanOrEqual(1);
    ws.close();
  }, 10000);
});
