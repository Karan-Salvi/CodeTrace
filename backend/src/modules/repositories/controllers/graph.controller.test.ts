import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";

// Embeddings' `vector` column is a Prisma `Unsupported("vector(1536)")`
// type — not writable via `prisma.embedding.create()`. Every existing
// test that needs a real embedding row uses a raw insert instead
// (dependency-retrieval.service.test.ts); this fixture follows the same
// pattern rather than inventing a new one.
const FAKE_VECTOR = `[${new Array(1536).fill(0).join(",")}]`;

async function makeAuthedUser() {
  const user = await prisma.user.create({
    data: { githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)), username: "octocat", githubAccessToken: "enc" },
  });
  const token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });
  return { user, token };
}

async function makeRepoWithGraph(userId: string) {
  const installation = await prisma.repositoryInstallation.create({
    data: { userId, githubInstallationId: BigInt(Math.floor(Math.random() * 1_000_000_000)), permissions: {} },
  });
  const repository = await prisma.repository.create({
    data: {
      userId,
      installationId: installation.id,
      owner: "octocat",
      name: "hello-world",
      githubUrl: "https://github.com/octocat/hello-world",
      defaultBranch: "main",
      status: "INDEXED",
    },
  });
  const fileA = await prisma.file.create({
    data: { repositoryId: repository.id, path: "src/a.ts", contentHash: "hash-a", sizeBytes: 10, lastIndexedSha: "sha1" },
  });
  const fileB = await prisma.file.create({
    data: { repositoryId: repository.id, path: "src/b.ts", contentHash: "hash-b", sizeBytes: 10, lastIndexedSha: "sha1" },
  });
  await prisma.$executeRaw`
    INSERT INTO embeddings (content_hash, model_version, vector, created_at)
    VALUES ('content-hash-1', 'v1', ${FAKE_VECTOR}::vector, now())
    ON CONFLICT (content_hash, model_version) DO NOTHING
  `;
  const chunkA = await prisma.chunk.create({
    data: {
      repositoryId: repository.id, fileId: fileA.id, symbol: "fnA", symbolType: "FUNCTION",
      language: "typescript", startLine: 1, endLine: 5, content: "function fnA() {}",
      contentHash: "content-hash-1", embeddingModelVersion: "v1",
    },
  });
  const chunkB = await prisma.chunk.create({
    data: {
      repositoryId: repository.id, fileId: fileB.id, symbol: "fnB", symbolType: "FUNCTION",
      language: "typescript", startLine: 1, endLine: 5, content: "function fnB() {}",
      contentHash: "content-hash-1", embeddingModelVersion: "v1",
    },
  });
  await prisma.symbolRelationship.create({
    data: { repositoryId: repository.id, fromChunkId: chunkA.id, toChunkId: chunkB.id, relationshipType: "CALLS" },
  });
  return { repository, chunkA, chunkB };
}

describe("GET /repositories/:id/graph", () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.file.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.symbolRelationship.deleteMany();
    await prisma.chunk.deleteMany();
    await prisma.file.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("requires auth", async () => {
    const res = await request(app).get("/repositories/some-id/graph");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a repository the caller doesn't own", async () => {
    const { user: owner } = await makeAuthedUser();
    const { repository } = await makeRepoWithGraph(owner.id);
    const { token: otherToken } = await makeAuthedUser();

    const res = await request(app)
      .get(`/repositories/${repository.id}/graph`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it("returns a file-level graph by default", async () => {
    const { user, token } = await makeAuthedUser();
    const { repository } = await makeRepoWithGraph(user.id);

    const res = await request(app)
      .get(`/repositories/${repository.id}/graph`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("file");
    expect(res.body.data.nodes).toHaveLength(2);
    expect(res.body.data.edges).toHaveLength(1);
    expect(res.body.data.edges[0].counts.CALLS).toBe(1);
  });

  it("returns a symbol-level graph scoped to root", async () => {
    const { user, token } = await makeAuthedUser();
    const { repository, chunkA, chunkB } = await makeRepoWithGraph(user.id);

    const res = await request(app)
      .get(`/repositories/${repository.id}/graph`)
      .query({ scope: "symbol", root: chunkA.id })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("symbol");
    expect(res.body.data.root).toBe(chunkA.id);
    expect(res.body.data.nodes.map((n: { id: string }) => n.id)).toEqual(expect.arrayContaining([chunkA.id, chunkB.id]));
  });

  it("returns 400 when scope=symbol has no root", async () => {
    const { user, token } = await makeAuthedUser();
    const { repository } = await makeRepoWithGraph(user.id);

    const res = await request(app)
      .get(`/repositories/${repository.id}/graph`)
      .query({ scope: "symbol" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 404 when root chunk doesn't belong to this repository", async () => {
    const { user, token } = await makeAuthedUser();
    const { repository } = await makeRepoWithGraph(user.id);

    const res = await request(app)
      .get(`/repositories/${repository.id}/graph`)
      .query({ scope: "symbol", root: "00000000-0000-0000-0000-000000000000" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
