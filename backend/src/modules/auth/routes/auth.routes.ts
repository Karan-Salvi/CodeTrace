import { Router } from "express";
import { startGithubLogin, githubCallback, refresh, logout, getMe, updateMe, deleteMe } from "../controllers/auth.controller.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";

export const authRoutes = Router();

authRoutes.get("/auth/github", asyncHandler(startGithubLogin));
authRoutes.get("/auth/github/callback", asyncHandler(githubCallback));
authRoutes.post("/auth/refresh", asyncHandler(refresh));
authRoutes.post("/auth/logout", asyncHandler(logout));

authRoutes.get("/auth/me", requireAuth, asyncHandler(getMe));
authRoutes.patch("/auth/me", requireAuth, asyncHandler(updateMe));
authRoutes.delete("/auth/me", requireAuth, asyncHandler(deleteMe));
