import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "../../../database/client.js";
import { vectorSearch } from "./vector-search.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";


function fakeVector(seed: string): number[] {
  const hash = createHash("sha256").update(seed).digest();
  const vec: number[] = [];
  for (let i = 0; i < 1536; i++) vec.push((hash[i % hash.length] / 255) * 2 - 1);
  return vec;
}

describe("vectorSearch", () => {
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

  it("returns ranked chunks scoped to the given repository", async () => {
    const chunk = await prisma.chunk.findFirstOrThrow({ where: { repositoryId, symbol: "handleAuthError" } });
    const queryVector = fakeVector(chunk.contentHash);

    const results = await vectorSearch(repositoryId, queryVector, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunkId).toBe(chunk.id);
  });

  it("never returns chunks from a different repository", async () => {
    const user2 = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other", githubAccessToken: "enc" },
    });
    const installation2 = await prisma.repositoryInstallation.create({
      data: { userId: user2.id, githubInstallationId: BigInt(2), permissions: {} },
    });
    const repository2 = await prisma.repository.create({
      data: {
        userId: user2.id,
        installationId: installation2.id,
        owner: "other",
        name: "repo2",
        githubUrl: "https://github.com/other/repo2",
        defaultBranch: "main",
      },
    });
    await processFixtureIndexJob(repository2.id);

    const queryVector = fakeVector("arbitrary-query");
    const results = await vectorSearch(repositoryId, queryVector, 20);

    const otherRepoChunks = await prisma.chunk.findMany({ where: { repositoryId: repository2.id } });
    const otherIds = new Set(otherRepoChunks.map((c) => c.id));
    expect(results.every((r) => !otherIds.has(r.chunkId))).toBe(true);
  });
});
