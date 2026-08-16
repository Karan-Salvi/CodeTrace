import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { postRetrievalRun, postPrRun } from "../controllers/evaluation.controller.js";

export const evaluationRoutes = Router();

evaluationRoutes.post("/evaluation/retrieval-run", requireAuth, asyncHandler(postRetrievalRun));
evaluationRoutes.post("/evaluation/pr-run", requireAuth, asyncHandler(postPrRun));
