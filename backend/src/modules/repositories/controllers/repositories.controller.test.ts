import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";

async function makeAuthedUser() {
  const user = await prisma.user.create({
    data: { githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)), username: "octocat", githubAccessToken: "enc" },
  });
  const token = jwt.sign({ userId: user.id, sessionId: "s1" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });
  return { user, token };
}

describe("repositories routes", () => {
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

  it("POST /repositories requires auth", async () => {
    const res = await request(app).post("/repositories").send({});
    expect(res.status).toBe(401);
  });

  it("POST /repositories connects a repository under an owned installation", async () => {
    const { user, token } = await makeAuthedUser();
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(1), permissions: {} },
    });

    const res = await request(app)
      .post("/repositories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        installationId: installation.id,
        owner: "octocat",
        name: "hello-world",
        githubUrl: "https://github.com/octocat/hello-world",
        defaultBranch: "main",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
  });

  it("POST /repositories rejects a githubUrl that isn't a github.com repo URL", async () => {
    // Regression: z.string().url() alone accepted any well-formed URL —
    // an authenticated user could register a repository row pointing at
    // an arbitrary internal URL, which the worker later git-clones
    // server-side with the installation token attached (SSRF via the
    // worker as a trusted-network actor).
    const { user, token } = await makeAuthedUser();
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(1), permissions: {} },
    });

    const res = await request(app)
      .post("/repositories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        installationId: installation.id,
        owner: "octocat",
        name: "hello-world",
        githubUrl: "http://169.254.169.254/latest/meta-data/",
        defaultBranch: "main",
      });

    expect(res.status).toBe(400);
  });

  it("POST /repositories rejects an installation owned by another user", async () => {
    const { token } = await makeAuthedUser();
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(999), username: "other", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: otherUser.id, githubInstallationId: BigInt(2), permissions: {} },
    });

    const res = await request(app)
      .post("/repositories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        installationId: installation.id,
        owner: "other",
        name: "repo",
        githubUrl: "https://github.com/other/repo",
        defaultBranch: "main",
      });

    expect(res.status).toBe(403);
  });

  it("GET /repositories returns only the caller's repositories", async () => {
    const { user, token } = await makeAuthedUser();
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: user.id, githubInstallationId: BigInt(3), permissions: {} },
    });
    await prisma.repository.create({
      data: {
        userId: user.id,
        installationId: installation.id,
        owner: "octocat",
        name: "repo-a",
        githubUrl: "https://github.com/octocat/repo-a",
        defaultBranch: "main",
      },
    });

    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(888), username: "other2", githubAccessToken: "enc" },
    });
    const otherInstallation = await prisma.repositoryInstallation.create({
      data: { userId: otherUser.id, githubInstallationId: BigInt(4), permissions: {} },
    });
    await prisma.repository.create({
      data: {
        userId: otherUser.id,
        installationId: otherInstallation.id,
        owner: "other2",
        name: "repo-b",
        githubUrl: "https://github.com/other2/repo-b",
        defaultBranch: "main",
      },
    });

    const res = await request(app).get("/repositories").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("repo-a");
  });

  it("DELETE /repositories/:id rejects deleting another user's repository", async () => {
    const { token } = await makeAuthedUser();
    const otherUser = await prisma.user.create({
      data: { githubId: BigInt(777), username: "other3", githubAccessToken: "enc" },
    });
    const installation = await prisma.repositoryInstallation.create({
      data: { userId: otherUser.id, githubInstallationId: BigInt(5), permissions: {} },
    });
    const repo = await prisma.repository.create({
      data: {
        userId: otherUser.id,
        installationId: installation.id,
        owner: "other3",
        name: "repo-c",
        githubUrl: "https://github.com/other3/repo-c",
        defaultBranch: "main",
      },
    });

    const res = await request(app).delete(`/repositories/${repo.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
