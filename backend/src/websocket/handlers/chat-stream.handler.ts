import type { WebSocket } from "ws";
import { verifyAccessToken } from "../../modules/auth/services/session.service.js";
import { askQuestion } from "../../modules/chat/services/chat.service.js";
import { prisma } from "../../database/client.js";

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
