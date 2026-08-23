import type { Request, Response } from "express";
import { prisma } from "../../../database/client.js";
import { getOwnedRepository } from "../../repositories/services/repository.service.js";
import { createConversationSchema } from "../validators/chat.validators.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { AppError } from "../../../core/errors/app-error.js";

export async function postConversation(req: Request, res: Response) {
  const repository = await getOwnedRepository(req.user!.id, req.params.id as string);
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }

  const conversation = await prisma.conversation.create({
    data: { repositoryId: repository.id, userId: req.user!.id, title: parsed.data.title },
  });
  sendSuccess(res, conversation, 201);
}

export async function getLatestConversation(req: Request, res: Response) {
  const repository = await getOwnedRepository(req.user!.id, req.params.id as string);

  // RepositoryChat.tsx resumes this one instead of always POSTing a new
  // conversation on every page load — without it, a page reload showed an
  // empty thread even though every prior question/answer was already
  // persisted (chat.service.ts writes both on every askQuestion() call).
  //
  // Ordered by the most recent MESSAGE, not the most recent conversation
  // row: before this endpoint existed, every reload created a fresh empty
  // conversation, so a plain "newest conversation" query would keep
  // resolving to one of those empty ones instead of the older conversation
  // that actually has the real thread in it.
  const lastMessage = await prisma.message.findFirst({
    where: { conversation: { repositoryId: repository.id, userId: req.user!.id } },
    orderBy: { createdAt: "desc" },
    include: { conversation: true },
  });
  if (lastMessage) {
    sendSuccess(res, lastMessage.conversation);
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { repositoryId: repository.id, userId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(res, conversation);
}

export async function getMessages(req: Request, res: Response) {
  await getOwnedRepository(req.user!.id, req.params.id as string);

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.conversationId as string } });
  if (!conversation || conversation.repositoryId !== (req.params.id as string)) {
    throw AppError.notFound("Conversation not found");
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  sendSuccess(res, messages);
}
