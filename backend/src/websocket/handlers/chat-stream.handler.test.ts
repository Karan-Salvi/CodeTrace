import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { createApp } from "../../app.js";
import { createWebSocketGateway } from "../gateway.js";
import { prisma } from "../../database/client.js";
import { env } from "../../config/env.js";
import { processFixtureIndexJob } from "../../../scripts/dev-fixture-worker.js";
import * as chatService from "../../modules/chat/services/chat.service.js";

describe("chat websocket gateway", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let repositoryId: string;
  let conversationId: string;
  let token: string;

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
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

    const conversation = await prisma.conversation.create({ data: { repositoryId, userId: user.id } });
    conversationId = conversation.id;

    token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });

    const app = createApp();
    server = createServer(app);
    createWebSocketGateway(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server?.close();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects a chat message with an invalid token", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const received = await new Promise<any>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "chat", repositoryId, conversationId, question: "x", token: "bad" }));
      });
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });
    expect(received.type).toBe("error");
    ws.close();
  });

  it("streams back a completed answer for a valid authenticated chat message", async () => {
    vi.spyOn(chatService, "askQuestion").mockResolvedValue({
      answer: "handleAuthError handles token expiry.",
      citations: [],
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const received = await new Promise<any>((resolve) => {
      ws.on("open", () => {
        ws.send(
          JSON.stringify({ type: "chat", repositoryId, conversationId, question: "what does handleAuthError do", token })
        );
      });
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    expect(received.type).toBe("chat:complete");
    expect(received.answer).toContain("handleAuthError");
    ws.close();
  });
});
