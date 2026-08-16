import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/database/client.js";
import { processFixtureIndexJob } from "./dev-fixture-worker.js";

describe("dev-fixture-worker", () => {
  beforeEach(async () => {
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
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

  it("writes files, chunks, embeddings, and symbol_relationships for a repository", async () => {
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

    await processFixtureIndexJob(repository.id);

    const chunks = await prisma.chunk.findMany({ where: { repositoryId: repository.id } });
    expect(chunks.length).toBeGreaterThan(0);

    const embeddings = await prisma.embedding.findMany();
    expect(embeddings.length).toBeGreaterThan(0);

    const relationships = await prisma.symbolRelationship.findMany({
      where: { repositoryId: repository.id },
    });
    expect(relationships.some((r) => r.relationshipType === "CALLS")).toBe(true);

    const repo = await prisma.repository.findUnique({ where: { id: repository.id } });
    expect(repo?.status).toBe("INDEXED");
  });
});
