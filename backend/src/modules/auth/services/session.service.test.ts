import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import {
  createSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  verifyAccessToken,
} from "./session.service.js";

async function makeUser() {
  return prisma.user.create({
    data: {
      githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)),
      username: "octocat",
      githubAccessToken: "encrypted-placeholder",
    },
  });
}

describe("session.service", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("creates a session and issues a valid access token", async () => {
    const user = await makeUser();
    const { accessToken, refreshToken } = await createSession(user.id, {});

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const payload = verifyAccessToken(accessToken);
    expect(payload?.userId).toBe(user.id);

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
  });

  it("allows two concurrent sessions for the same user (multi-device)", async () => {
    const user = await makeUser();
    await createSession(user.id, {});
    await createSession(user.id, {});

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(2);
  });

  it("rotates a refresh token into a new pair and invalidates the old one", async () => {
    const user = await makeUser();
    const { refreshToken } = await createSession(user.id, {});

    const rotated = await rotateSession(refreshToken);
    expect(rotated).not.toBeNull();
    expect(rotated!.refreshToken).not.toBe(refreshToken);

    const reused = await rotateSession(refreshToken);
    expect(reused).toBeNull();
  });

  it("revokes a single session without affecting others", async () => {
    const user = await makeUser();
    const first = await createSession(user.id, {});
    await createSession(user.id, {});

    await revokeSession(first.refreshToken);

    const rotateAttempt = await rotateSession(first.refreshToken);
    expect(rotateAttempt).toBeNull();

    const remaining = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(remaining).toHaveLength(1);
  });

  it("revokes all sessions for a user", async () => {
    const user = await makeUser();
    const first = await createSession(user.id, {});
    await createSession(user.id, {});

    await revokeAllSessions(user.id);

    expect(await rotateSession(first.refreshToken)).toBeNull();
    const active = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(active).toHaveLength(0);
  });

  it("verifyAccessToken returns null for a garbage token", () => {
    expect(verifyAccessToken("not-a-real-token")).toBeNull();
  });
});
