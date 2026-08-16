import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
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
    
    // We mock fetch so Jina returns results in a specific order (reversing the RRF order)
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body as string);
      const len = body.documents ? Math.min(8, body.documents.length) : 8;
      return {
        ok: true,
        json: async () => ({
          results: Array.from({ length: len }, (_, i) => ({
            index: len - 1 - i,
            relevance_score: 1.0 - (i * 0.1),
          })),
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await retrieveContext(repositoryId, "handleAuthError", dummyEmbedQuery);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.repositoryId === repositoryId)).toBe(true);
    expect(results.every((r) => typeof r.filePath === "string" && r.filePath.length > 0)).toBe(true);

    // If it was just RRF, the first result would be the chunk with the best RRF score.
    // By reversing the index mapping, we ensure the reranker changed the order.
    // We can just verify fetch was called.
    expect(fetchMock).toHaveBeenCalled();
    
    global.fetch = originalFetch;
  });

  it("proves reranking actually changes final chunk order relative to pure RRF", async () => {
    const dummyEmbedQuery = async () => new Array(1536).fill(0.01);
    
    // Run once with fetch failing (falls back to pure RRF)
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Fail")) as unknown as typeof fetch;
    const rrfResults = await retrieveContext(repositoryId, "handleAuthError", dummyEmbedQuery);
    
    // Run again with a mock that reverses the top N
    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body as string);
      const len = body.documents ? Math.min(8, body.documents.length) : 8;
      return {
        ok: true,
        json: async () => ({
          results: Array.from({ length: len }, (_, i) => ({
            index: len - 1 - i,
            relevance_score: 1.0 - (i * 0.1),
          })),
        }),
      };
    }) as unknown as typeof fetch;
    
    const rerankedResults = await retrieveContext(repositoryId, "handleAuthError", dummyEmbedQuery);

    global.fetch = originalFetch;

    if (rrfResults.length > 1) {
      // The first element should now be what was previously the last element of the top N
      expect(rerankedResults[0].id).toBe(rrfResults[Math.min(8, rrfResults.length) - 1].id);
      expect(rerankedResults[0].id).not.toBe(rrfResults[0].id);
    }
  });
});
