import type { Request, Response } from "express";
import { prisma } from "../../../database/client.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { AppError } from "../../../core/errors/app-error.js";
import { usageSummaryQuerySchema } from "../validators/usage.validators.js";

export async function getUsageSummary(req: Request, res: Response) {
  const parsed = usageSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }
  const { days } = parsed.data;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Now includes INDEXING logs as well.
  const logs = await prisma.usageLog.findMany({
    where: { createdAt: { gte: cutoff }, kind: { in: ["QA", "PR_REVIEW", "INDEXING"] } },
    include: { repository: { select: { id: true, owner: true, name: true } } },
  });

  const byKind: Record<"QA" | "PR_REVIEW" | "INDEXING", { costUsd: number; tokens: number; calls: number }> = {
    QA: { costUsd: 0, tokens: 0, calls: 0 },
    PR_REVIEW: { costUsd: 0, tokens: 0, calls: 0 },
    INDEXING: { costUsd: 0, tokens: 0, calls: 0 },
  };
  const byDay = new Map<string, { costUsd: number; calls: number }>();
  const byRepo = new Map<string, { owner: string; name: string; costUsd: number; calls: number }>();

  let totalCostUsd = 0;
  let totalTokens = 0;

  for (const log of logs) {
    const cost = Number(log.costUsd ?? 0);
    const tokens = log.tokensUsed ?? 0;
    totalCostUsd += cost;
    totalTokens += tokens;

    if (log.kind === "QA" || log.kind === "PR_REVIEW" || log.kind === "INDEXING") {
      byKind[log.kind].costUsd += cost;
      byKind[log.kind].tokens += tokens;
      byKind[log.kind].calls += 1;
    }

    const day = log.createdAt.toISOString().slice(0, 10);
    const dayEntry = byDay.get(day) ?? { costUsd: 0, calls: 0 };
    dayEntry.costUsd += cost;
    dayEntry.calls += 1;
    byDay.set(day, dayEntry);

    const repoEntry = byRepo.get(log.repositoryId) ?? {
      owner: log.repository.owner,
      name: log.repository.name,
      costUsd: 0,
      calls: 0,
    };
    repoEntry.costUsd += cost;
    repoEntry.calls += 1;
    byRepo.set(log.repositoryId, repoEntry);
  }

  const daily = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topRepositories = Array.from(byRepo.entries())
    .map(([repositoryId, v]) => ({ repositoryId, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);

  sendSuccess(res, {
    rangeDays: days,
    totals: { costUsd: totalCostUsd, tokens: totalTokens, calls: logs.length, byKind },
    daily,
    topRepositories,
  });
}
