import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { getAuthorizeUrl, upsertUserFromProfile } from "./github-oauth.service.js";
import { decrypt } from "../../../core/utils/encryption.js";

describe("github-oauth.service", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
  });

  it("builds an authorize URL with the correct scopes and state", () => {
    const url = getAuthorizeUrl("random-state-123");
    expect(url).toContain("github.com/login/oauth/authorize");
    expect(url).toContain("scope=read%3Auser%20user%3Aemail");
    expect(url).toContain("state=random-state-123");
  });

  it("upserts a new user and encrypts the access token", async () => {
    const profile = { id: 42, login: "octocat", email: "octo@example.com", avatar_url: "https://x/y.png" };
    const user = await upsertUserFromProfile(profile, "gho_realtoken123");

    expect(user.githubId).toBe(BigInt(42));
    expect(user.username).toBe("octocat");
    expect(decrypt(user.githubAccessToken)).toBe("gho_realtoken123");
  });

  it("updates an existing user on repeat login rather than creating a duplicate", async () => {
    const profile = { id: 42, login: "octocat", email: "octo@example.com", avatar_url: "https://x/y.png" };
    await upsertUserFromProfile(profile, "gho_first");

    const updatedProfile = { ...profile, username: "octocat", avatar_url: "https://x/new.png" };
    const user = await upsertUserFromProfile(updatedProfile, "gho_second");

    const all = await prisma.user.findMany({ where: { githubId: BigInt(42) } });
    expect(all).toHaveLength(1);
    expect(decrypt(user.githubAccessToken)).toBe("gho_second");
  });
});
