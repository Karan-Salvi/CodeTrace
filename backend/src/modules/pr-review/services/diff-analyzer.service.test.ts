import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { mapChangedLinesToChunks } from "./diff-analyzer.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";

describe("mapChangedLinesToChunks", () => {
  let repositoryId: string;

  beforeEach(async () => {
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
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
    await prisma.prReview.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.file.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("maps a changed line range to the overlapping chunk", async () => {
    const results = await mapChangedLinesToChunks(repositoryId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 3, endLine: 5 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe("handleAuthError");
  });

  it("returns no results for a line range outside any chunk", async () => {
    const results = await mapChangedLinesToChunks(repositoryId, [
      { filePath: "src/auth/handleAuthError.ts", startLine: 500, endLine: 510 },
    ]);
    expect(results).toHaveLength(0);
  });

  it("returns no results for a file not in the repository", async () => {
    const results = await mapChangedLinesToChunks(repositoryId, [
      { filePath: "src/nonexistent.ts", startLine: 1, endLine: 5 },
    ]);
    expect(results).toHaveLength(0);
  });
});
