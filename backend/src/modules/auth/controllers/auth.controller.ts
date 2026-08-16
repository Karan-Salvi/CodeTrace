import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import {
  getAuthorizeUrl,
  exchangeCodeForProfile,
  upsertUserFromProfile,
} from "../services/github-oauth.service.js";
import { createSession, rotateSession, revokeSession } from "../services/session.service.js";
import { callbackQuerySchema } from "../validators/auth.validators.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { env } from "../../../config/env.js";

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

  res.redirect("/auth/success");
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
