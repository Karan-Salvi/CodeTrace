import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { createRateLimiter } from "../../../core/middlewares/rate-limit.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { postTriggerIndex } from "../controllers/indexing.controller.js";

export const indexingRoutes = Router();

// why this number: Full indexing is an expensive and naturally infrequent operation.
// 5 times per hour is more than enough for normal usage while preventing runaway costs.
const indexingRateLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, name: "indexing" });

indexingRoutes.post("/repositories/:id/index", requireAuth, indexingRateLimiter, asyncHandler(postTriggerIndex));
