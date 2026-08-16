import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { getPrReviews } from "../controllers/pr-review.controller.js";

export const prReviewRoutes = Router();

prReviewRoutes.get(
  "/repositories/:id/pull-requests/:prId/reviews",
  requireAuth,
  asyncHandler(getPrReviews)
);
