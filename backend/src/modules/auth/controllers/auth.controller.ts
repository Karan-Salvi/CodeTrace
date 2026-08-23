import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import {
  getAuthorizeUrl,
  exchangeCodeForProfile,
  upsertUserFromProfile,
} from "../services/github-oauth.service.js";
import { createSession, rotateSession, revokeSession, revokeAllSessions } from "../services/session.service.js";
import { callbackQuerySchema, updateProfileSchema } from "../validators/auth.validators.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../database/client.js";

const REFRESH_COOKIE = "codetrace_refresh";
const STATE_COOKIE = "codetrace_oauth_state";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

export async function startGithubLogin(req: Request, res: Response) {
  const state = randomUUID();
  res.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
  res.redirect(getAuthorizeUrl(state));
}

export async function githubCallback(req: Request, res: Response) {
  const parsed = callbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_CALLBACK", "Missing code or state");
  }

  const expectedState = req.cookies?.[STATE_COOKIE];
  if (!expectedState || expectedState !== parsed.data.state) {
    throw AppError.badRequest("INVALID_STATE", "OAuth state mismatch");
  }

  const profile = await exchangeCodeForProfile(parsed.data.code);
  const user = await upsertUserFromProfile(profile, profile.accessToken);

  // auth.md: "frontend never touches the token directly" — the access
  // token must not go through a URL. It used to be appended as
  // ?token=... on this redirect, which persists in browser history,
  // typically gets logged by infra-level access logs (nginx/CDN, unlike
  // this app's own request-logger which only logs req.path), and leaks
  // via the Referer header to any third-party resource the success page
  // loads. Only the refresh token (already httpOnly-cookie-only) is set
  // here; the frontend calls POST /auth/refresh immediately after this
  // redirect to mint its first access token from that cookie.
  const { refreshToken } = await createSession(user.id, {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  });

  res.clearCookie(STATE_COOKIE);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // Bug: this used to be a relative redirect ("/auth/success"), which
  // stays on the BACKEND's own origin — the frontend runs on a different
  // origin/port (CORS_ORIGIN) in every real deployment, so the browser
  // would 404 here since the backend has no such route. Must redirect to
  // the frontend's own /auth/success page.
  res.redirect(`${env.CORS_ORIGIN}/auth/success`);
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) {
    throw AppError.unauthorized("No refresh token");
  }

  const rotated = await rotateSession(refreshToken);
  if (!rotated) {
    throw AppError.unauthorized("Refresh token invalid or expired");
  }

  res.cookie(REFRESH_COOKIE, rotated.refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(res, { accessToken: rotated.accessToken });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (refreshToken) {
    await revokeSession(refreshToken);
  }
  res.clearCookie(REFRESH_COOKIE);
  sendSuccess(res, { loggedOut: true });
}

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, createdAt: true },
  });
  if (!user) {
    throw AppError.unauthorized("User not found");
  }
  sendSuccess(res, user);
}

export async function updateMe(req: Request, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_PROFILE", parsed.error.issues[0]?.message ?? "Invalid profile update");
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { displayName: parsed.data.displayName },
    select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, createdAt: true },
  });
  sendSuccess(res, user);
}

export async function deleteMe(req: Request, res: Response) {
  // Every user-owned row (sessions, repository installations, repositories
  // and everything cascading from them, conversations) is declared
  // onDelete: Cascade in schema.prisma, so a single row delete here is
  // enough — Postgres handles the cascade, no manual cleanup needed.
  await revokeAllSessions(req.user!.id);
  await prisma.user.delete({ where: { id: req.user!.id } });
  res.clearCookie(REFRESH_COOKIE);
  sendSuccess(res, { deleted: true });
}
