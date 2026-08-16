import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import type { Prisma } from "@prisma/client";

// GitHub's App-installation flow: the user clicks "Connect GitHub", we
// send them to GitHub's own install picker with `state` set to their
// already-issued access token (a short-lived signed JWT, reused as-is
// rather than inventing a second signing scheme just for this one
// redirect). GitHub redirects back to this app's configured Setup URL
// with installation_id + the same state — see installationCallback in
// repositories.controller.ts, which verifies it the same way requireAuth
// does, then creates the RepositoryInstallation row tied to that userId.
// The `installation` webhook's `created` action is NOT a reliable
// creation path here: GitHub does not guarantee it arrives before (or
// even close to) the setup-URL redirect, and it carries no CodeTrace
// userId to link the row to — only the setup-URL redirect (which we
// control the state param on) can do that. The webhook path is kept for
// `deleted`/`suspend` (revocation), where no user-linking is needed.
export function getInstallUrl(state: string): string {
  return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;
}

export async function createInstallation(
  userId: string,
  githubInstallationId: bigint,
  permissions: Prisma.JsonValue
) {
  // upsert, not create: the setup-URL callback and the `installation`
  // webhook's `created` action can both observe the same
  // githubInstallationId (GitHub doesn't guarantee only one fires, or an
  // ordering between them) — the DB's existing unique constraint on
  // githubInstallationId would turn a second create() into an unhandled
  // P2002 error instead of the idempotent no-op this should be.
  return prisma.repositoryInstallation.upsert({
    where: { githubInstallationId },
    create: { userId, githubInstallationId, permissions: permissions ?? {} },
    update: { permissions: permissions ?? {}, revokedAt: null },
  });
}

export async function revokeInstallation(githubInstallationId: bigint) {
  return prisma.repositoryInstallation.updateMany({
    where: { githubInstallationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getActiveInstallation(id: string) {
  const installation = await prisma.repositoryInstallation.findUnique({ where: { id } });
  if (!installation || installation.revokedAt) return null;
  return installation;
}
