import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import * as githubAppService from "../services/github-app.service.js";

describe("GET /internal/repositories/:id/installation-token", () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects a request with no internal secret", async () => {
    const res = await request(app).get("/internal/repositories/00000000-0000-0000-0000-000000000000/installation-token");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a repository that does not exist", async () => {
    const res = await request(app)
      .get("/internal/repositories/00000000-0000-0000-0000-000000000000/installation-token")
      .set("x-internal-secret", env.INTERNAL_API_SECRET);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the repository's installation is revoked", async () => {
    const user = await prisma.user.create({
      data: { githubId: BigInt(1), username: "octocat", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: {
        userId: user.id,
        githubInstallationId: BigInt(42),
        permissions: {},
        revokedAt: new Date(),
      },
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

    const res = await request(app)
      .get(`/internal/repositories/${repository.id}/installation-token`)
      .set("x-internal-secret", env.INTERNAL_API_SECRET);
    expect(res.status).toBe(404);
  });

  it("mints and returns a fresh installation token for a valid repository", async () => {
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "ghs_faketoken",
      expiresAt: new Date("2026-08-14T13:00:00Z"),
    });

    const user = await prisma.user.create({
      data: { githubId: BigInt(2), username: "octocat2", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(43), permissions: {} },
    });
    const repository = await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "octocat2",
        name: "repo2",
        githubUrl: "https://github.com/octocat2/repo2",
        defaultBranch: "main",
      },
    });

    const res = await request(app)
      .get(`/internal/repositories/${repository.id}/installation-token`)
      .set("x-internal-secret", env.INTERNAL_API_SECRET);

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe("ghs_faketoken");
    expect(res.body.data.expiresAt).toBe("2026-08-14T13:00:00.000Z");
  });
});
