import { randomUUID } from "node:crypto";
import { prisma } from "../../../database/client.js";
import { enqueuePrReviewJob } from "../../../queues/producers/pr-review.producer.js";
import { revokeInstallation } from "../../repositories/services/installation.service.js";
import { createAndEnqueueIndexJob } from "../../indexing/services/index-job.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import type {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubInstallationEvent,
} from "../types/webhook.types.js";

function splitFullName(fullName: string): { owner: string; name: string } | null {
  const [owner, name] = fullName.split("/");
  return owner && name ? { owner, name } : null;
}

export async function handlePushEvent(payload: GitHubPushEvent): Promise<void> {
  const parsed = splitFullName(payload.repository.full_name);
  if (!parsed) return;

  // Exact owner/name match, not a githubUrl substring match — a
  // "contains" match on full_name would also match a repo whose name is
  // a superstring (e.g. "octocat/hello-world" matching a connected
  // "octocat/hello-world-fork"), silently routing the webhook to the
  // wrong repository.
  //
  // security.md: "revoking access must stop all future indexing/webhook
  // processing for that installation immediately" — without this filter
  // a push webhook for a repo whose GitHub App installation was just
  // uninstalled/suspended still matches and still enqueues a real
  // indexing job.
  const repository = await prisma.repository.findFirst({
    where: { owner: parsed.owner, name: parsed.name, installation: { revokedAt: null } },
  });
  if (!repository) return;

  try {
    await createAndEnqueueIndexJob(repository.id, "INCREMENTAL", repository.status);
  } catch (err: unknown) {
    if (err instanceof AppError && err.code === "ALREADY_INDEXING") {
      // A push arriving while this repo is already being indexed is
      // expected/benign for a webhook (not a user error to surface).
      return;
    }
    throw err;
  }
}

export async function handlePullRequestEvent(payload: GitHubPullRequestEvent): Promise<void> {
  if (!["opened", "synchronize"].includes(payload.action)) return;

  const parsed = splitFullName(payload.repository.full_name);
  if (!parsed) return;

  // Same revoked-installation gate as handlePushEvent — a PR webhook for
  // a repo whose installation was revoked must not enqueue a real LLM
  // review call.
  const repository = await prisma.repository.findFirst({
    where: { owner: parsed.owner, name: parsed.name, installation: { revokedAt: null } },
  });
  if (!repository) return;

  const pullRequest = await prisma.pullRequest.upsert({
    where: {
      repositoryId_githubPrNumber: {
        repositoryId: repository.id,
        githubPrNumber: payload.number,
      },
    },
    create: {
      repositoryId: repository.id,
      githubPrNumber: payload.number,
      title: payload.pull_request.title,
      author: payload.pull_request.user.login,
      baseSha: payload.pull_request.base.sha,
      headSha: payload.pull_request.head.sha,
    },
    update: {
      title: payload.pull_request.title,
      headSha: payload.pull_request.head.sha,
    },
  });

  await enqueuePrReviewJob({
    jobId: randomUUID(),
    pullRequestId: pullRequest.id,
    repositoryId: repository.id,
    commitSha: payload.pull_request.head.sha,
  });
}

export async function handleInstallationEvent(payload: GitHubInstallationEvent): Promise<void> {
  if (payload.action === "deleted" || payload.action === "suspend") {
    await revokeInstallation(BigInt(payload.installation.id));
  }
}
