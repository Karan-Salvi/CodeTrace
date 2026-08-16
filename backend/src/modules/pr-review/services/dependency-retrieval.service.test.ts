import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { getOneHopDependencies, hasTestCoverage } from "./dependency-retrieval.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";

const FAKE_VECTOR = `[${new Array(1536).fill(0).join(",")}]`;

describe("dependency-retrieval.service", () => {
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

  it("finds the caller of a changed symbol one hop out", async () => {
    const calledChunk = await prisma.chunk.findFirstOrThrow({ where: { symbol: "handleAuthError" } });
    const deps = await getOneHopDependencies(repositoryId, [calledChunk.id]);
    expect(deps.some((d) => d.symbol === "login")).toBe(true);
  });

  it("hasTestCoverage returns false when no matching test file exists (fixture set has none)", async () => {
    expect(await hasTestCoverage(repositoryId, "handleAuthError")).toBe(false);
  });

  it("hasTestCoverage does not credit a matching test file from a different repository", async () => {
    // Regression: hasTestCoverage previously searched the chunks table with
    // no repositoryId filter at all — a symbol with test coverage in ANY
    // repository (any customer's repo) would silently make an unrelated
    // repository's PR look tested when it isn't, undercounting its real
    // risk score.
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(2), username: "other-owner", githubAccessToken: "enc" },
    });
    const otherInstallation = await prisma.repositoryInstallation.create({
      data: { userId: otherUser.id, githubInstallationId: BigInt(2), permissions: {} },
    });
    const otherRepository = await prisma.repository.create({
      data: {
        userId: otherUser.id,
        installationId: otherInstallation.id,
        owner: "other-owner",
        name: "other-repo",
        githubUrl: "https://github.com/other-owner/other-repo",
        defaultBranch: "main",
      },
    });
    const otherFile = await prisma.file.create({
      data: {
        repositoryId: otherRepository.id,
        path: "src/auth/handleAuthError.test.ts",
        language: "typescript",
        contentHash: "test-hash-cross-repo",
        sizeBytes: 10,
        lastIndexedSha: "sha-cross-repo",
      },
    });
    await prisma.$executeRaw`
      INSERT INTO embeddings (content_hash, model_version, vector, created_at)
      VALUES ('test-hash-cross-repo', 'test-model', ${FAKE_VECTOR}::vector, now())
      ON CONFLICT (content_hash, model_version) DO NOTHING
    `;
    await prisma.chunk.create({
      data: {
        repositoryId: otherRepository.id,
        fileId: otherFile.id,
        symbol: "handleAuthError",
        symbolType: "FUNCTION",
        language: "typescript",
        startLine: 1,
        endLine: 3,
        content: "test('handleAuthError', () => {})",
        contentHash: "test-hash-cross-repo",
        embeddingModelVersion: "test-model",
      },
    });

    expect(await hasTestCoverage(repositoryId, "handleAuthError")).toBe(false);
    expect(await hasTestCoverage(otherRepository.id, "handleAuthError")).toBe(true);

    await prisma.chunk.deleteMany({ where: { repositoryId: otherRepository.id } });
    await prisma.embedding.deleteMany({ where: { contentHash: "test-hash-cross-repo" } });
    await prisma.file.deleteMany({ where: { repositoryId: otherRepository.id } });
    await prisma.repository.delete({ where: { id: otherRepository.id } });
    await prisma.repositoryInstallation.delete({ where: { id: otherInstallation.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});
