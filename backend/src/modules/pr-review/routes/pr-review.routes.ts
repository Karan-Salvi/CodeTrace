import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { createRateLimiter } from "../../../core/middlewares/rate-limit.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { getPrReviews } from "../controllers/pr-review.controller.js";

export const prReviewRoutes = Router();

// why this number: 60 times a minute prevents DB query spam.
// Note: The plan requested rate limiting the "route that actually triggers a review"
// and mentioned it triggers an LLM call, but there is no such HTTP endpoint here
// (reviews appear to be triggered via webhooks). Applied to the GET route instead.
const prReviewRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60, name: "pr-review" });

prReviewRoutes.get(
  "/repositories/:id/pull-requests/:prId/reviews",
  requireAuth,
  prReviewRateLimiter,
  asyncHandler(getPrReviews)
);
