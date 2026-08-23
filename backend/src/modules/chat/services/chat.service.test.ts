import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { askQuestion } from "./chat.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";
import * as llmService from "./llm.service.js";

describe("askQuestion", () => {
  let repositoryId: string;
  let conversationId: string;

  beforeEach(async () => {
    await prisma.usageLog.deleteMany();
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

    const conversation = await prisma.conversation.create({
      data: { repositoryId, userId: user.id },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await prisma.usageLog.deleteMany();
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

  it("returns a grounded answer with valid citations and persists the message", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));
    vi.spyOn(llmService, "generateChatCompletion").mockResolvedValue({
      text: "handleAuthError checks for TokenExpiredError. [src/auth/handleAuthError.ts:1-12]",
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const result = await askQuestion(repositoryId, conversationId, "what does handleAuthError do");

    expect(result.answer).toContain("handleAuthError");
    expect(result.citations.length).toBeGreaterThan(0);

    const messages = await prisma.message.findMany({ where: { conversationId } });
    expect(messages.some((m) => m.role === "ASSISTANT")).toBe(true);

    const usageLogs = await prisma.usageLog.findMany({ where: { kind: "QA" } });
    expect(usageLogs).toHaveLength(1);
    expect(usageLogs[0]?.tokensUsed).toBe(150);
    expect(Number(usageLogs[0]?.costUsd)).toBeGreaterThan(0);
  });

  it("returns the hallucination-guard response when retrieval finds nothing", async () => {
    vi.spyOn(llmService, "embedQuery").mockResolvedValue(new Array(1536).fill(0.01));

    const result = await askQuestion(
      "00000000-0000-0000-0000-000000000000",
      conversationId,
      "anything"
    );

    expect(result.answer).toContain("couldn't find enough evidence");
    expect(result.citations).toHaveLength(0);

    const usageLogs = await prisma.usageLog.findMany({ where: { kind: "QA" } });
    expect(usageLogs).toHaveLength(0);
  });
});
