import { Prisma } from "@prisma/client";
import { prisma } from "../../../database/client.js";

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
  return existing !== null;
}

export async function markEventProcessed(
  eventId: string,
  eventType: string,
  repositoryId: string | null
): Promise<void> {
  // database.md: webhook_events(event_id) unique constraint is the actual
  // idempotency mechanism — this upsert makes a race between two
  // concurrent deliveries of the same event_id resolve to one row.
  await prisma.webhookEvent.upsert({
    where: { eventId },
    create: { eventId, eventType, repositoryId },
    update: {},
  });
}

// Atomically claims an event_id via the DB-level unique constraint —
// returns true only for the caller that actually won the insert.
// isEventProcessed()+markEventProcessed() used separately (check-then-act
// with the real work running in between) leaves a race window: two
// concurrent redeliveries of the same event_id (GitHub does redeliver on
// timeout/no-200) can both see "not processed yet" and both run the
// handler — a duplicate INCREMENTAL index enqueue or duplicate PR-review
// LLM call, real cost security.md's idempotency requirement exists to
// prevent. This must be the ONLY gate the webhook controller uses; the
// two functions above stay for direct/manual checks (e.g. tests, ops).
export async function tryClaimEvent(
  eventId: string,
  eventType: string,
  repositoryId: string | null
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { eventId, eventType, repositoryId } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}
