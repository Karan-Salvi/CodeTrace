import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import * as githubOauth from "../services/github-oauth.service.js";

describe("auth routes", () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("GET /auth/github redirects to the GitHub authorize URL", async () => {
    const res = await request(app).get("/auth/github");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("github.com/login/oauth/authorize");
  });

  it("GET /auth/github/callback issues a session and sets cookies", async () => {
    vi.spyOn(githubOauth, "exchangeCodeForProfile").mockResolvedValue({
      id: 99,
      login: "octocat",
      email: "octo@example.com",
      avatar_url: "https://x/y.png",
      accessToken: "gho_faketoken",
    });

    const agent = request.agent(app);
    const initial = await agent.get("/auth/github");
    const stateCookie = initial.headers["set-cookie"] as unknown as string[];

    const res = await agent
      .get("/auth/github/callback")
      .set("Cookie", stateCookie.join("; "))
      .query({ code: "fake-code", state: extractState(stateCookie) });

    expect(res.status).toBe(302);
    const setCookies = res.headers["set-cookie"] as unknown as string[];
    expect(setCookies.some((c) => c.startsWith("codetrace_refresh="))).toBe(true);

    const user = await prisma.user.findUnique({ where: { githubId: BigInt(99) } });
    expect(user).not.toBeNull();
  });

  it("GET /auth/github/callback never puts the access token in the redirect URL", async () => {
    // Regression: the callback used to redirect to /auth/success?token=...
    // — the access token in a URL persists in browser history, typically
    // gets logged by infra-level access logs, and leaks via the Referer
    // header to any third-party resource the success page loads. auth.md:
    // "frontend never touches the token directly."
    vi.spyOn(githubOauth, "exchangeCodeForProfile").mockResolvedValue({
      id: 100,
      login: "octocat2",
      email: "octo2@example.com",
      avatar_url: "https://x/y.png",
      accessToken: "gho_faketoken2",
    });

    const agent = request.agent(app);
    const initial = await agent.get("/auth/github");
    const stateCookie = initial.headers["set-cookie"] as unknown as string[];

    const res = await agent
      .get("/auth/github/callback")
      .set("Cookie", stateCookie.join("; "))
      .query({ code: "fake-code-2", state: extractState(stateCookie) });

    expect(res.status).toBe(302);
    // Regression: this used to be a relative "/auth/success", which
    // stays on the backend's own origin — the frontend runs on a
    // different origin (CORS_ORIGIN) in every real deployment, so that
    // redirect 404'd. Must land on the frontend's own origin.
    expect(res.headers.location).toBe(`${env.CORS_ORIGIN}/auth/success`);
    expect(res.headers.location).not.toContain("token=");
  });

  it("POST /auth/refresh with no cookie returns 401", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  function extractState(cookies: string[]): string {
    const stateCookie = cookies.find((c) => c.startsWith("codetrace_oauth_state="));
    const match = stateCookie?.match(/codetrace_oauth_state=([^;]+)/);
    return decodeURIComponent(match?.[1] ?? "");
  }
});
