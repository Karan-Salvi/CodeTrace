import type { Request, Response } from "express";
import { connectRepositorySchema } from "../validators/repository.validators.js";
import { installationCallbackQuerySchema } from "../validators/installation.validators.js";
import {
  connectRepository,
  listRepositories,
  deleteRepository,
  listAvailableRepos,
} from "../services/repository.service.js";
import { getInstallUrl, createInstallation, listInstallations } from "../services/installation.service.js";
import { verifyAccessToken } from "../../auth/services/session.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../database/client.js";

export async function postRepository(req: Request, res: Response) {
  const parsed = connectRepositorySchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }
  const repository = await connectRepository(req.user!.id, parsed.data);
  sendSuccess(res, repository, 201);
}

export async function getRepositories(req: Request, res: Response) {
  const repositories = await listRepositories(req.user!.id);
  sendSuccess(res, repositories);
}

export async function deleteRepositoryHandler(req: Request, res: Response) {
  await deleteRepository(req.user!.id, req.params.id as string);
  sendSuccess(res, { deleted: true });
}

// Step 1 of the install flow: an authenticated frontend request returns
// the GitHub App install URL, with `state` set to this same request's
// own (already-verified) access token — reused as the state param rather
// than issuing a second short-lived token, since it's already exactly
// that (short-lived, signed, verifiable) and requireAuth on this route
// already proved it's valid for req.user.id.
export async function getInstallationUrl(req: Request, res: Response) {
  const header = req.headers.authorization!; // requireAuth already validated this exists and is well-formed
  const accessToken = header.slice("Bearer ".length);
  sendSuccess(res, { url: getInstallUrl(accessToken) });
}

// Step 2: GitHub redirects the user's browser here after they approve
// the install — a plain top-level GET with no Authorization header
// possible, so the state param (the access token from step 1) is what
// proves which CodeTrace user this installation belongs to. This route
// is intentionally NOT behind requireAuth (a redirect can't carry a
// bearer header) — verifyAccessToken on the state param IS the auth
// check here.
export async function installationCallback(req: Request, res: Response) {
  const parsed = installationCallbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_CALLBACK", "Missing installation_id or state");
  }

  const payload = verifyAccessToken(parsed.data.state);
  if (!payload) {
    throw AppError.unauthorized("Invalid or expired installation state");
  }

  if (parsed.data.setup_action === "install") {
    // Permissions are populated later by the `installation` webhook's
    // `created` action (out of scope for this fix — see
    // installation.service.ts's getInstallUrl comment); this row's
    // existence is what unblocks POST /repositories, not its permissions
    // field.
    await createInstallation(payload.userId, BigInt(parsed.data.installation_id), {});
  }

  res.redirect(`${env.CORS_ORIGIN}/repositories?installed=${parsed.data.setup_action}`);
}

export async function getInstallations(req: Request, res: Response) {
  const installations = await listInstallations(req.user!.id);
  // Convert BigInt to string before JSON serialization
  const serialized = installations.map((inst) => ({
    ...inst,
    githubInstallationId: inst.githubInstallationId.toString(),
  }));
  sendSuccess(res, serialized);
}

export async function getAvailableRepos(req: Request, res: Response) {
  const repos = await listAvailableRepos(req.user!.id, req.params.id as string);
  sendSuccess(res, repos);
}

export async function getPullRequests(req: Request, res: Response) {
  // Validate ownership
  await prisma.repository.findFirstOrThrow({
    where: { id: req.params.id as string, userId: req.user!.id },
  });

  const prs = await prisma.pullRequest.findMany({
    where: { repositoryId: req.params.id as string },
    orderBy: { createdAt: "desc" },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          riskScore: true,
          riskLevel: true,
          createdAt: true,
        },
      },
    },
  });

  const mapped = prs.map((pr) => {
    const latestReview = pr.reviews[0] ?? null;
    return {
      id: pr.id,
      githubPrNumber: pr.githubPrNumber,
      title: pr.title,
      author: pr.author,
      baseSha: pr.baseSha,
      headSha: pr.headSha,
      createdAt: pr.createdAt,
      latestReview,
    };
  });

  sendSuccess(res, { pullRequests: mapped });
}
