import { Router } from "express";
import { startGithubLogin, githubCallback, refresh, logout } from "../controllers/auth.controller.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";

export const authRoutes = Router();

authRoutes.get("/auth/github", asyncHandler(startGithubLogin));
authRoutes.get("/auth/github/callback", asyncHandler(githubCallback));
authRoutes.post("/auth/refresh", asyncHandler(refresh));
authRoutes.post("/auth/logout", asyncHandler(logout));
