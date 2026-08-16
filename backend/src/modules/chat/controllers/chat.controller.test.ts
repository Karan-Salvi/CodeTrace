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
});
