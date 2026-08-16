import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { requireInternalAuth } from "../../../core/middlewares/internal-auth.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import {
  postRepository,
  getRepositories,
  deleteRepositoryHandler,
  getInstallationUrl,
  installationCallback,
} from "../controllers/repositories.controller.js";
import { getInstallationToken } from "../controllers/internal.controller.js";

export const repositoriesRoutes = Router();

repositoriesRoutes.post("/repositories", requireAuth, asyncHandler(postRepository));
repositoriesRoutes.get("/repositories", requireAuth, asyncHandler(getRepositories));
repositoriesRoutes.delete("/repositories/:id", requireAuth, asyncHandler(deleteRepositoryHandler));
repositoriesRoutes.get(
  "/internal/repositories/:id/installation-token",
  requireInternalAuth,
  asyncHandler(getInstallationToken)
);

// Step 1: frontend calls this (authenticated) to get the GitHub App
// install URL before redirecting the browser to GitHub.
repositoriesRoutes.get(
  "/repositories/installation-url",
  requireAuth,
  asyncHandler(getInstallationUrl)
);
// Step 2: GitHub redirects the browser here after install — this MUST
// NOT have requireAuth (see installationCallback's own comment for why).
// This path must match the GitHub App's configured "Setup URL" exactly.
repositoriesRoutes.get(
  "/repositories/installation-callback",
  asyncHandler(installationCallback)
);
