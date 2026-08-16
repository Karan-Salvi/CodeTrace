import jwt from "jsonwebtoken";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "../../../config/constants.js";
import type { AccessTokenPayload, SessionMeta, TokenPair } from "../types/auth.types.js";

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function issueAccessToken(userId: string, sessionId: string): string {
  const payload: AccessTokenPayload = { userId, sessionId };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

export async function createSession(userId: string, meta: SessionMeta): Promise<TokenPair> {
  const refreshToken = randomUUID() + randomUUID();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    },
  });

  const accessToken = issueAccessToken(userId, session.id);
  return { accessToken, refreshToken };
}

export async function rotateSession(refreshToken: string): Promise<TokenPair | null> {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash } });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return createSession(session.userId, {
    userAgent: session.userAgent ?? undefined,
    ipAddress: session.ipAddress ?? undefined,
  });
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
