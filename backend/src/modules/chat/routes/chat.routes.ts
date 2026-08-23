import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { createRateLimiter } from "../../../core/middlewares/rate-limit.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import {
  postConversation,
  getLatestConversation,
  getMessages,
} from "../controllers/chat.controller.js";

export const chatRoutes = Router();

// why this number: Creating conversations is lightweight, but we want to prevent spam.
// Note: The plan requested rate limiting the "message-send route", but messages are sent
// via websockets, not Express routes. Applied to conversation creation instead.
const chatRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "chat",
});

chatRoutes.post(
  "/repositories/:id/conversations",
  requireAuth,
  chatRateLimiter,
  asyncHandler(postConversation),
);
chatRoutes.get(
  "/repositories/:id/conversations/latest",
  requireAuth,
  asyncHandler(getLatestConversation),
);
chatRoutes.get(
  "/repositories/:id/conversations/:conversationId/messages",
  requireAuth,
  asyncHandler(getMessages),
);
