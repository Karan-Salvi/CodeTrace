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

  describe("GitHub App installation flow", () => {
    it("GET /repositories/installation-url requires auth", async () => {
      const res = await request(app).get("/repositories/installation-url");
      expect(res.status).toBe(401);
    });

    it("GET /repositories/installation-url returns a GitHub install URL with the caller's access token as state", async () => {
      const { token } = await makeAuthedUser();
      const res = await request(app)
        .get("/repositories/installation-url")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.url).toContain("https://github.com/apps/");
      expect(res.body.data.url).toContain("/installations/new?state=");
      expect(res.body.data.url).toContain(encodeURIComponent(token));
    });

    it("GET /repositories/installation-callback creates a RepositoryInstallation tied to the state's user", async () => {
      // Regression: before this fix, nothing anywhere in the backend
      // ever called createInstallation — handleInstallationEvent only
      // handled deleted/suspend, so a RepositoryInstallation row could
      // never exist and POST /repositories (which requires a real
      // installationId) was permanently unusable for any real user.
      const { user, token } = await makeAuthedUser();

      const res = await request(app)
        .get("/repositories/installation-callback")
        .query({ installation_id: "999888", state: token, setup_action: "install" });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(`${env.CORS_ORIGIN}/repositories`);

      const installation = await prisma.repositoryInstallation.findUnique({
        where: { githubInstallationId: BigInt(999888) },
      });
      expect(installation).not.toBeNull();
      expect(installation?.userId).toBe(user.id);
      expect(installation?.revokedAt).toBeNull();
    });

    it("GET /repositories/installation-callback rejects an invalid or expired state", async () => {
      const res = await request(app)
        .get("/repositories/installation-callback")
        .query({ installation_id: "111222", state: "not-a-real-token", setup_action: "install" });

      expect(res.status).toBe(401);
      const installation = await prisma.repositoryInstallation.findUnique({
        where: { githubInstallationId: BigInt(111222) },
      });
      expect(installation).toBeNull();
    });

    it("GET /repositories/installation-callback is idempotent for the same githubInstallationId", async () => {
      const { user, token } = await makeAuthedUser();

      await request(app)
        .get("/repositories/installation-callback")
        .query({ installation_id: "333444", state: token, setup_action: "install" });
      const res2 = await request(app)
        .get("/repositories/installation-callback")
        .query({ installation_id: "333444", state: token, setup_action: "install" });

      expect(res2.status).toBe(302);
      const installations = await prisma.repositoryInstallation.findMany({
        where: { githubInstallationId: BigInt(333444) },
      });
      expect(installations).toHaveLength(1);
      expect(installations[0].userId).toBe(user.id);
    });

    it("GET /repositories/installations requires auth", async () => {
      const res = await request(app).get("/repositories/installations");
      expect(res.status).toBe(401);
    });

    it("GET /repositories/installations returns only the caller's non-revoked installations", async () => {
      const { user, token } = await makeAuthedUser();
      
      // Valid installation for caller
      await prisma.repositoryInstallation.create({
        data: { userId: user.id, githubInstallationId: BigInt(10), permissions: {} },
      });
      
      // Revoked installation for caller
      await prisma.repositoryInstallation.create({
        data: { userId: user.id, githubInstallationId: BigInt(11), permissions: {}, revokedAt: new Date() },
      });

      // Valid installation for other user
      const otherUser = await prisma.user.create({
        data: { githubId: BigInt(999), username: "other", githubAccessToken: "enc" },
      });
      await prisma.repositoryInstallation.create({
        data: { userId: otherUser.id, githubInstallationId: BigInt(12), permissions: {} },
      });

      const res = await request(app)
        .get("/repositories/installations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].githubInstallationId).toBe("10");
    });
  });
});
