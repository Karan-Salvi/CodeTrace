import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { INDEX_JOB_QUEUE } from "../index.js";
import type { IndexJobPayload } from "@codetrace/shared-types";

const indexJobQueue = new Queue<IndexJobPayload>(INDEX_JOB_QUEUE, {
  connection: { url: env.REDIS_URL },
});

export async function enqueueIndexJob(payload: IndexJobPayload): Promise<void> {
  // indexing.md: "retries use exponential backoff, capped attempt count" —
  // BullMQ defaults to attempts: 1 (no retry) unless set explicitly here.
  await indexJobQueue.add(INDEX_JOB_QUEUE, payload, {
    jobId: payload.jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
