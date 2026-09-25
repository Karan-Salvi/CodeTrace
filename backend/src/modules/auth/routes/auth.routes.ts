import { Router } from "express";
import type { Request } from "express";
import { startGithubLogin, githubCallback, refresh, logout, getMe, updateMe, deleteMe } from "../controllers/auth.controller.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { createRateLimiter } from "../../../core/middlewares/rate-limit.middleware.js";

export const authRoutes = Router();

// Pre-auth endpoints have no req.user yet, so key by IP instead of the
// default per-user bucket — otherwise every anonymous caller would share
// one global "anonymous" quota. 20/15min is generous for real users
// (a handful of logins/refreshes) while blocking credential-stuffing/flood.
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: "auth",
  keyGenerator: (req: Request) => req.ip ?? "unknown",
});

authRoutes.get("/auth/github", authRateLimiter, asyncHandler(startGithubLogin));
authRoutes.get("/auth/github/callback", authRateLimiter, asyncHandler(githubCallback));
authRoutes.post("/auth/refresh", authRateLimiter, asyncHandler(refresh));
authRoutes.post("/auth/logout", authRateLimiter, asyncHandler(logout));

authRoutes.get("/auth/me", requireAuth, asyncHandler(getMe));
authRoutes.patch("/auth/me", requireAuth, asyncHandler(updateMe));
authRoutes.delete("/auth/me", requireAuth, asyncHandler(deleteMe));
