import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { keywordSearch } from "./keyword-search.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";

describe("keywordSearch", () => {
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

  it("finds the exact-identifier match for handleAuthError", async () => {
    const results = await keywordSearch(repositoryId, "handleAuthError", 5);
    expect(results.length).toBeGreaterThan(0);

    const topChunk = await prisma.chunk.findUnique({ where: { id: results[0].chunkId } });
    expect(topChunk?.symbol).toBe("handleAuthError");
  });

  it("does not stem identifiers (simple config, not english)", async () => {
    // 'connectRepository' should not fuzzily match unrelated stemmed forms
    const results = await keywordSearch(repositoryId, "connectRepository", 5);
    const topChunk = await prisma.chunk.findUnique({ where: { id: results[0].chunkId } });
    expect(topChunk?.symbol).toBe("connectRepository");
  });

  it("matches a natural-language question against a keyword it shares with the content, instead of requiring every word (including stopwords) to match", async () => {
    // Regression: plainto_tsquery ANDs every token by default, and the
    // 'simple' text-search config (deliberately used here, database.md,
    // since code identifiers aren't English words) does not strip
    // stopwords the way 'english' would. A natural question like this one
    // contains "how"/"are", which never appear in code content — an
    // AND-of-every-token query guarantees zero rows regardless of how
    // relevant the content actually is. Real users type natural
    // questions, not bare identifiers, so this made keyword search (and
    // therefore its contribution to hybrid RRF) silently useless for any
    // query that wasn't already a literal code identifier.
    const results = await keywordSearch(repositoryId, "How are token expiry authentication errors handled?", 5);
    expect(results.length).toBeGreaterThan(0);

    const topChunk = await prisma.chunk.findUnique({ where: { id: results[0].chunkId } });
    expect(topChunk?.symbol).toBe("handleAuthError");
  });

  it("returns no results scoped outside the repository", async () => {
    const results = await keywordSearch("00000000-0000-0000-0000-000000000000", "handleAuthError", 5);
    expect(results).toHaveLength(0);
  });
});
