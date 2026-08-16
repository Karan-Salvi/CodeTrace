import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../../../database/client.js";
import { handlePushEvent, handlePullRequestEvent } from "./webhook-dispatcher.service.js";
import * as indexJobProducer from "../../../queues/producers/index-job.producer.js";
import * as prReviewProducer from "../../../queues/producers/pr-review.producer.js";

async function makeRepo(revoked: boolean) {
  const user = await prisma.user.create({
    data: { githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)), username: "octocat", githubAccessToken: "enc" },
  });
  const installation = await prisma.repositoryInstallation.create({
    data: {
      userId: user.id,
      githubInstallationId: BigInt(Math.floor(Math.random() * 1_000_000_000)),
      permissions: {},
      revokedAt: revoked ? new Date() : null,
    },
  });
  const repository = await prisma.repository.create({
    data: {
      userId: user.id,
      installationId: installation.id,
      owner: "octocat",
      name: "hello-world",
      githubUrl: "https://github.com/octocat/hello-world",
      defaultBranch: "main",
    },
  });
  return repository;
}

describe("webhook-dispatcher.service", () => {
  beforeEach(async () => {
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("handlePushEvent does not enqueue an index job for a repo whose installation is revoked", async () => {
    // security.md: "revoking access must stop all future indexing/webhook
    // processing for that installation immediately."
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(true);

    await handlePushEvent({
      after: "sha1",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    });

    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it("handlePushEvent enqueues an index job for a repo with an active installation", async () => {
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(false);

    await handlePushEvent({
      after: "sha1",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    });

    expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({ repositoryId: repo.id }));
  });

  it("handlePullRequestEvent does not enqueue a review job for a repo whose installation is revoked", async () => {
    const enqueueSpy = vi.spyOn(prReviewProducer, "enqueuePrReviewJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(true);

    await handlePullRequestEvent({
      action: "opened",
      number: 1,
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      pull_request: {
        title: "test",
        user: { login: "octocat" },
        base: { sha: "base1" },
        head: { sha: "head1" },
      },
    });

    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});
