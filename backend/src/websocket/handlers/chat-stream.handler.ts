import type { WebSocket } from "ws";
import { verifyAccessToken } from "../../modules/auth/services/session.service.js";
import { askQuestion } from "../../modules/chat/services/chat.service.js";
import { checkRateLimit } from "../../core/middlewares/rate-limit.middleware.js";
import { prisma } from "../../database/client.js";

// why this number: chat.routes.ts's HTTP rate limiter only covers
// conversation *creation*, not individual messages — this is the actual
// per-message LLM-cost driver security.md's "/chat" rate-limiting
// requirement targets. A real back-and-forth conversation can
// reasonably send several messages a minute; 20/min gives headroom for
// normal use while still bounding a scripted-spam worst case.
const CHAT_MESSAGE_RATE_LIMIT = { windowMs: 60_000, max: 20 };

interface ChatMessage {
  type: "chat";
  repositoryId: string;
  conversationId: string;
  question: string;
  token: string;
}

export async function handleChatMessage(ws: WebSocket, raw: string): Promise<void> {
  let message: ChatMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    return;
  }

  if (message.type !== "chat") return;

  const payload = verifyAccessToken(message.token);
  if (!payload) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    return;
  }

  const withinLimit = await checkRateLimit(payload.userId, CHAT_MESSAGE_RATE_LIMIT);
  if (!withinLimit) {
    ws.send(JSON.stringify({ type: "error", message: "Too many requests" }));
    return;
  }

  const repository = await prisma.repository.findUnique({ where: { id: message.repositoryId } });
  if (!repository || repository.userId !== payload.userId) {
    ws.send(JSON.stringify({ type: "error", message: "Repository not found" }));
    return;
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: message.conversationId } });
  if (!conversation || conversation.repositoryId !== message.repositoryId) {
    ws.send(JSON.stringify({ type: "error", message: "Conversation not found" }));
    return;
  }

  try {
    const result = await askQuestion(message.repositoryId, message.conversationId, message.question);
    ws.send(JSON.stringify({ type: "chat:complete", answer: result.answer, citations: result.citations }));
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: err instanceof Error ? err.message : "Chat failed",
      })
    );
  }
}
