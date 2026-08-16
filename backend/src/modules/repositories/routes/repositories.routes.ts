import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { requireInternalAuth } from "../../../core/middlewares/internal-auth.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import {
  postRepository,
  getRepositories,
  deleteRepositoryHandler,
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
