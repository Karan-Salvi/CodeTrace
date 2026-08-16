import { Router } from "express";
import { verifyWebhookSignature } from "../../../core/middlewares/webhook-signature.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { postGithubWebhook } from "../controllers/webhooks.controller.js";

export const webhooksRoutes = Router();

webhooksRoutes.post(
  "/webhooks/github",
  verifyWebhookSignature,
  asyncHandler(postGithubWebhook)
);
