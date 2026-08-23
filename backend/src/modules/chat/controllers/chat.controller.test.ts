import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";

describe("chat routes", () => {
  const app = createApp();
  let repositoryId: string;
  let token: string;

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
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
    token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });
  });

  afterAll(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("POST /repositories/:id/conversations creates a conversation", async () => {
    const res = await request(app)
      .post(`/repositories/${repositoryId}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.repositoryId).toBe(repositoryId);
  });

  it("GET /repositories/:id/conversations/:conversationId/messages returns persisted messages", async () => {
    const conversation = await prisma.conversation.create({
      data: { repositoryId, userId: (await prisma.user.findFirstOrThrow()).id },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "USER", content: "hi" },
    });

    const res = await request(app)
      .get(`/repositories/${repositoryId}/conversations/${conversation.id}/messages`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].content).toBe("hi");
  });

  it("GET /repositories/:id/conversations requires auth", async () => {
    const res = await request(app).get(`/repositories/${repositoryId}/conversations`);
    expect(res.status).toBe(401);
  });

  it("GET /repositories/:id/conversations excludes conversations with zero messages", async () => {
    const userId = (await prisma.user.findFirstOrThrow()).id;
    await prisma.conversation.create({ data: { repositoryId, userId } }); // no messages — must not appear

    const withMessage = await prisma.conversation.create({ data: { repositoryId, userId } });
    await prisma.message.create({ data: { conversationId: withMessage.id, role: "USER", content: "hello" } });

    const res = await request(app)
      .get(`/repositories/${repositoryId}/conversations`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.conversations).toHaveLength(1);
    expect(res.body.data.conversations[0].id).toBe(withMessage.id);
  });

  it("GET /repositories/:id/conversations derives the title from the first USER message", async () => {
    const userId = (await prisma.user.findFirstOrThrow()).id;
    const conversation = await prisma.conversation.create({ data: { repositoryId, userId } });
    await prisma.message.create({ data: { conversationId: conversation.id, role: "USER", content: "What does this repo do?" } });
    await prisma.message.create({ data: { conversationId: conversation.id, role: "ASSISTANT", content: "It's a note-taking app." } });

    const res = await request(app)
      .get(`/repositories/${repositoryId}/conversations`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.conversations[0]).toMatchObject({
      title: "What does this repo do?",
      messageCount: 2,
    });
  });

  it("GET /repositories/:id/conversations truncates a long first message to 60 chars", async () => {
    const userId = (await prisma.user.findFirstOrThrow()).id;
    const conversation = await prisma.conversation.create({ data: { repositoryId, userId } });
    const longQuestion = "a".repeat(100);
    await prisma.message.create({ data: { conversationId: conversation.id, role: "USER", content: longQuestion } });

    const res = await request(app)
      .get(`/repositories/${repositoryId}/conversations`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.conversations[0].title).toBe(`${"a".repeat(60)}…`);
  });

  it("GET /repositories/:id/conversations sorts by most recent message first", async () => {
    const userId = (await prisma.user.findFirstOrThrow()).id;
    const older = await prisma.conversation.create({ data: { repositoryId, userId } });
    await prisma.message.create({ data: { conversationId: older.id, role: "USER", content: "first" } });

    await new Promise((r) => setTimeout(r, 10));

    const newer = await prisma.conversation.create({ data: { repositoryId, userId } });
    await prisma.message.create({ data: { conversationId: newer.id, role: "USER", content: "second" } });

    const res = await request(app)
      .get(`/repositories/${repositoryId}/conversations`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.conversations.map((c: { id: string }) => c.id)).toEqual([newer.id, older.id]);
  });

  it("GET /repositories/:id/conversations returns 404 for a repository the caller doesn't own", async () => {
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other", githubAccessToken: "enc" },
    });
    const otherToken = jwt.sign({ userId: otherUser.id, sessionId: "s2" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });

    const res = await request(app)
      .get(`/repositories/${repositoryId}/conversations`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
