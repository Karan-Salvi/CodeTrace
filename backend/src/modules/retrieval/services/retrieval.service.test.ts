import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { retrieveContext } from "./retrieval.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";

describe("retrieveContext", () => {
  let repositoryId: string;

  beforeEach(async () => {
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
  });

  afterAll(async () => {
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("returns retrieved chunks with file paths attached, scoped to the repository", async () => {
    const dummyEmbedQuery = async () => new Array(1536).fill(0.01);
    const results = await retrieveContext(repositoryId, "handleAuthError", dummyEmbedQuery);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.repositoryId === repositoryId)).toBe(true);
    expect(results.every((r) => typeof r.filePath === "string" && r.filePath.length > 0)).toBe(true);
  });
});
