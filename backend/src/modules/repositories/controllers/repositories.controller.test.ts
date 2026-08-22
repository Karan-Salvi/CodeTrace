import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import * as githubFileContentService from "../services/github-file-content.service.js";
import * as githubAppService from "../services/github-app.service.js";
import { processFixtureIndexJob } from "../../../../scripts/dev-fixture-worker.js";

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

  describe("GET /repositories/installations/:id/available-repos", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("requires auth", async () => {
      const res = await request(app).get("/repositories/installations/some-id/available-repos");
      expect(res.status).toBe(401);
    });

    it("rejects an installation owned by another user", async () => {
      const { token } = await makeAuthedUser();
      const otherUser = await prisma.user.create({
        data: { githubId: BigInt(555), username: "other4", githubAccessToken: "enc" },
      });
      const installation = await prisma.repositoryInstallation.create({
        data: { userId: otherUser.id, githubInstallationId: BigInt(20), permissions: {} },
      });

      const res = await request(app)
        .get(`/repositories/installations/${installation.id}/available-repos`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("returns the installation's GitHub repos, flagging already-connected ones", async () => {
      const { user, token } = await makeAuthedUser();
      const installation = await prisma.repositoryInstallation.create({
        data: { userId: user.id, githubInstallationId: BigInt(21), permissions: {} },
      });
      await prisma.repository.create({
        data: {
          userId: user.id,
          installationId: installation.id,
          owner: "octocat",
          name: "hello-world",
          githubUrl: "https://github.com/octocat/hello-world",
          defaultBranch: "main",
        },
      });

      const fetchMock = vi
        .fn()
        // mintInstallationToken
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: "ghs_faketoken", expires_at: "2026-08-14T13:00:00Z" }),
        })
        // listInstallationRepositories
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            repositories: [
              {
                name: "hello-world",
                full_name: "octocat/hello-world",
                private: false,
                default_branch: "main",
                owner: { login: "octocat" },
                html_url: "https://github.com/octocat/hello-world",
              },
              {
                name: "not-yet-connected",
                full_name: "octocat/not-yet-connected",
                private: true,
                default_branch: "develop",
                owner: { login: "octocat" },
                html_url: "https://github.com/octocat/not-yet-connected",
              },
            ],
          }),
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await request(app)
        .get(`/repositories/installations/${installation.id}/available-repos`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        {
          owner: "octocat",
          name: "hello-world",
          githubUrl: "https://github.com/octocat/hello-world",
          defaultBranch: "main",
          private: false,
          alreadyConnected: true,
        },
        {
          owner: "octocat",
          name: "not-yet-connected",
          githubUrl: "https://github.com/octocat/not-yet-connected",
          defaultBranch: "develop",
          private: true,
          alreadyConnected: false,
        },
      ]);
    });
  });

  describe("GET /:id/pull-requests", () => {
    it("returns 200 with PRs and their latest review status, sorted by creation date descending", async () => {
      const { user, token } = await makeAuthedUser();
      const installation = await prisma.repositoryInstallation.create({
        data: { userId: user.id, githubInstallationId: BigInt(1), permissions: {} },
      });
      const repo = await prisma.repository.create({
        data: {
          userId: user.id,
          installationId: installation.id,
          owner: "octocat",
          name: "repo1",
          githubUrl: "url",
          defaultBranch: "main",
        },
      });

      const pr1 = await prisma.pullRequest.create({
        data: {
          repositoryId: repo.id,
          githubPrNumber: 1,
          title: "PR 1",
          author: "octocat",
          baseSha: "base1",
          headSha: "head1",
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      });

      const pr2 = await prisma.pullRequest.create({
        data: {
          repositoryId: repo.id,
          githubPrNumber: 2,
          title: "PR 2",
          author: "octocat",
          baseSha: "base2",
          headSha: "head2",
          createdAt: new Date("2024-01-02T00:00:00Z"),
        },
      });

      // pr2 has a COMPLETE review
      await prisma.prReview.create({
        data: {
          pullRequestId: pr2.id,
          commitSha: "head2",
          status: "COMPLETE",
          riskScore: 20,
          riskLevel: "LOW",
        },
      });

      // pr1 has two reviews from two separate pushes (distinct commits —
      // pr_reviews has a real DB unique constraint on
      // (pullRequestId, commitSha), so two reviews for the identical
      // commit isn't a valid fixture), one PENDING and one COMPLETE; we
      // should get the latest (by createdAt). Prisma defaults to now(),
      // so creating them sequentially works.
      await prisma.prReview.create({
        data: { pullRequestId: pr1.id, commitSha: "head1-earlier-push", status: "COMPLETE" },
      });
      const latestReview = await prisma.prReview.create({
        data: { pullRequestId: pr1.id, commitSha: "head1", status: "PENDING" },
      });

      const res = await request(app)
        .get(`/repositories/${repo.id}/pull-requests`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pullRequests).toHaveLength(2);
      
      // Sorted by createdAt desc, so PR 2 is first
      expect(res.body.data.pullRequests[0].id).toBe(pr2.id);
      expect(res.body.data.pullRequests[0].latestReview.status).toBe("COMPLETE");
      
      expect(res.body.data.pullRequests[1].id).toBe(pr1.id);
      expect(res.body.data.pullRequests[1].latestReview.id).toBe(latestReview.id);
      expect(res.body.data.pullRequests[1].latestReview.status).toBe("PENDING");
    });
  });
});

describe("GET /repositories/:id/pull-requests/:prId/diff", () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  async function setUp() {
    const { user, token } = await makeAuthedUser();
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
    const pullRequest = await prisma.pullRequest.create({
      data: {
        repositoryId: repository.id,
        githubPrNumber: 1,
        title: "Fix bug",
        author: "octocat",
        baseSha: "base123",
        headSha: "head456",
      },
    });
    return { token, repository, pullRequest };
  }

  it("returns original/modified content and language for a normal file", async () => {
    const { token, repository, pullRequest } = await setUp();
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "gh-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubFileContentService, "fetchFileAtRef").mockImplementation(async (_t, _o, _r, _path, ref) => {
      return ref === "base123"
        ? { content: "old content\n" }
        : { content: "new content\n" };
    });

    const res = await request(app)
      .get(`/repositories/${repository.id}/pull-requests/${pullRequest.id}/diff`)
      .query({ file: "src/foo.ts" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ original: "old content\n", modified: "new content\n", language: "typescript" });
  });

  it("returns empty original for a file added in this PR (no version at baseSha)", async () => {
    const { token, repository, pullRequest } = await setUp();
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "gh-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubFileContentService, "fetchFileAtRef").mockImplementation(async (_t, _o, _r, _path, ref) => {
      return ref === "base123" ? null : { content: "brand new file\n" };
    });

    const res = await request(app)
      .get(`/repositories/${repository.id}/pull-requests/${pullRequest.id}/diff`)
      .query({ file: "src/new-file.ts" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ original: "", modified: "brand new file\n", language: "typescript" });
  });

  it("returns previewUnavailable when the file is binary or too large", async () => {
    const { token, repository, pullRequest } = await setUp();
    vi.spyOn(githubAppService, "mintInstallationToken").mockResolvedValue({
      token: "gh-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(githubFileContentService, "fetchFileAtRef").mockImplementation(async (_t, _o, _r, _path, ref) => {
      return ref === "base123" ? { content: "", tooLarge: true } : { content: "", tooLarge: true };
    });

    const res = await request(app)
      .get(`/repositories/${repository.id}/pull-requests/${pullRequest.id}/diff`)
      .query({ file: "assets/huge.bin" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ previewUnavailable: true });
  });

  it("400s when the file query parameter is missing", async () => {
    const { token, repository, pullRequest } = await setUp();

    const res = await request(app)
      .get(`/repositories/${repository.id}/pull-requests/${pullRequest.id}/diff`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("404s for a pull request belonging to a repository the user does not own", async () => {
    const { repository, pullRequest } = await setUp();
    const { token: otherToken } = await makeAuthedUser();

    const res = await request(app)
      .get(`/repositories/${repository.id}/pull-requests/${pullRequest.id}/diff`)
      .query({ file: "src/foo.ts" })
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});

describe("GET /repositories/:id/chunks/:chunkId", () => {
  const app = createApp();

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

  async function setUp() {
    const { user, token } = await makeAuthedUser();
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
    const chunk = await prisma.chunk.findFirstOrThrow({
      where: { repositoryId: repository.id, symbol: "handleAuthError" },
    });
    return { token, repository, chunk };
  }

  it("returns the chunk's content, language, file path, and line range", async () => {
    const { token, repository, chunk } = await setUp();

    const res = await request(app)
      .get(`/repositories/${repository.id}/chunks/${chunk.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      content: chunk.content,
      language: "typescript",
      filePath: "src/auth/handleAuthError.ts",
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    });
  });

  it("404s for a chunk belonging to a repository the user does not own", async () => {
    const { repository, chunk } = await setUp();
    const { token: otherToken } = await makeAuthedUser();

    const res = await request(app)
      .get(`/repositories/${repository.id}/chunks/${chunk.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it("404s for a chunkId that doesn't exist", async () => {
    const { token, repository } = await setUp();

    const res = await request(app)
      .get(`/repositories/${repository.id}/chunks/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
