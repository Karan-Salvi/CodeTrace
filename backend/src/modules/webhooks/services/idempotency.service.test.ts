import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { isEventProcessed, markEventProcessed } from "./idempotency.service.js";

describe("idempotency.service", () => {
  beforeEach(async () => {
    await prisma.webhookEvent.deleteMany();
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany();
  });

  it("reports an unseen event as not processed", async () => {
    expect(await isEventProcessed("evt-1")).toBe(false);
  });

  it("marks an event processed and then reports it as processed", async () => {
    await markEventProcessed("evt-2", "push", null);
    expect(await isEventProcessed("evt-2")).toBe(true);
  });

  it("marking the same event_id twice does not throw (race-safe no-op)", async () => {
    await markEventProcessed("evt-3", "push", null);
    await expect(markEventProcessed("evt-3", "push", null)).resolves.not.toThrow();

    const count = await prisma.webhookEvent.count({ where: { eventId: "evt-3" } });
    expect(count).toBe(1);
  });
});
