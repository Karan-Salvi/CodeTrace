import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { requireOperator } from "../../../core/middlewares/operator.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { getUsageSummary } from "../controllers/usage.controller.js";

export const usageRoutes = Router();

usageRoutes.get("/usage/summary", requireAuth, requireOperator, asyncHandler(getUsageSummary));
