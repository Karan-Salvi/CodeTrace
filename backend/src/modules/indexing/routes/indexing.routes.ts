import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { postTriggerIndex } from "../controllers/indexing.controller.js";

export const indexingRoutes = Router();

// TODO: apply rate-limit middleware once core/middlewares/rate-limit.middleware.ts exists
indexingRoutes.post("/repositories/:id/index", requireAuth, asyncHandler(postTriggerIndex));
