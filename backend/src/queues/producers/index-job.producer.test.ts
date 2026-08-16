import { describe, it, expect, afterAll } from "vitest";
import { Queue } from "bullmq";
import { enqueueIndexJob } from "./index-job.producer.js";
import { INDEX_JOB_QUEUE } from "../index.js";
import { env } from "../../config/env.js";

describe("index-job.producer", () => {
  const inspectQueue = new Queue(INDEX_JOB_QUEUE, { connection: { url: env.REDIS_URL } });

  afterAll(async () => {
    await inspectQueue.obliterate({ force: true });
    await inspectQueue.close();
  });

  it("enqueues a job with the given payload", async () => {
    await enqueueIndexJob({ jobId: "job-1", repositoryId: "repo-1", type: "FULL" });

    const jobs = await inspectQueue.getJobs(["waiting"]);
    expect(jobs.some((j) => j.data.jobId === "job-1")).toBe(true);
  });
});
