import { Router } from "express";
import { requireAuth } from "../../../core/middlewares/auth.middleware.js";
import { asyncHandler } from "../../../core/utils/async-handler.js";
import { postConversation, getMessages } from "../controllers/chat.controller.js";

export const chatRoutes = Router();

chatRoutes.post("/repositories/:id/conversations", requireAuth, asyncHandler(postConversation));
chatRoutes.get(
  "/repositories/:id/conversations/:conversationId/messages",
  requireAuth,
  asyncHandler(getMessages)
);
