import type { Request, Response } from "express";
import { prisma } from "../../../database/client.js";
import { tryClaimEvent } from "../services/idempotency.service.js";
import {
  handlePushEvent,
  handlePullRequestEvent,
  handleInstallationEvent,
} from "../services/webhook-dispatcher.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";

export async function postGithubWebhook(req: Request, res: Response) {
  const eventType = req.headers["x-github-event"] as string | undefined;
  const deliveryId = req.headers["x-github-delivery"] as string | undefined;

  if (!eventType || !deliveryId) {
    throw AppError.badRequest("MISSING_HEADERS", "Missing x-github-event or x-github-delivery");
  }

  // tryClaimEvent is the atomic gate (DB unique constraint on eventId) —
  // isEventProcessed()+markEventProcessed() used separately here left a
  // race window where two concurrent redeliveries of the same event_id
  // could both pass the check before either marked it processed, both
  // running the handler below (duplicate index enqueue / duplicate PR
  // review LLM call).
  const claimed = await tryClaimEvent(deliveryId, eventType, null);
  if (!claimed) {
    return sendSuccess(res, { deduped: true });
  }

  try {
    switch (eventType) {
      case "push":
        await handlePushEvent(req.body);
        break;
      case "pull_request":
        await handlePullRequestEvent(req.body);
        break;
      case "installation":
        await handleInstallationEvent(req.body);
        break;
      default:
        break;
    }
  } catch (err) {
    // Claiming happens before the handler runs (that's the whole point —
    // it closes the race window). If the handler itself fails, release
    // the claim so a legitimate GitHub redelivery of this event_id can
    // retry, instead of being deduped forever by a failed first attempt.
    await prisma.webhookEvent.delete({ where: { eventId: deliveryId } }).catch(() => {});
    throw err;
  }

  sendSuccess(res, { processed: true });
}
