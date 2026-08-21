import type { WebSocket } from "ws";
import { verifyAccessToken } from "../../modules/auth/services/session.service.js";
import { prisma } from "../../database/client.js";

interface SubscribePrReviewProgressMessage {
  type: "subscribe-pr-review-progress";
  pullRequestId: string;
  token: string;
}

const POLL_INTERVAL_MS = 500;
const TERMINAL_STATUSES = new Set(["COMPLETE", "FAILED"]);

interface LastSeen {
  status: string;
  riskScore: number | null;
  riskLevel: string | null;
}

interface WebSocketWithPrReviewProgressState extends WebSocket {
  __prReviewProgressInterval?: NodeJS.Timeout;
  __prReviewProgressCloseListener?: () => void;
}

// Mirrors index-progress.handler.ts's polling shape exactly — same
// per-socket single-interval/single-close-listener discipline, same
// terminal-status-stops-the-poll behavior, just against PrReview instead
// of Repository.
export async function handlePrReviewProgressSubscription(
  wsInput: WebSocket,
  raw: string
): Promise<void> {
  const ws = wsInput as WebSocketWithPrReviewProgressState;
  let message: SubscribePrReviewProgressMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    return;
  }

  if (message.type !== "subscribe-pr-review-progress") return;

  const payload = verifyAccessToken(message.token);
  if (!payload) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    return;
  }

  const pullRequest = await prisma.pullRequest.findUnique({
    where: { id: message.pullRequestId },
    include: { repository: true },
  });
  if (!pullRequest || pullRequest.repository.userId !== payload.userId) {
    ws.send(JSON.stringify({ type: "error", message: "Pull request not found" }));
    return;
  }

  if (ws.__prReviewProgressInterval) {
    clearInterval(ws.__prReviewProgressInterval);
  }
  if (ws.__prReviewProgressCloseListener) {
    ws.off("close", ws.__prReviewProgressCloseListener);
  }

  let lastSeen: LastSeen | null = null;

  const interval = setInterval(async () => {
    const current = await prisma.prReview.findFirst({
      where: { pullRequestId: message.pullRequestId },
      orderBy: { createdAt: "desc" },
      select: { status: true, riskScore: true, riskLevel: true },
    });
    if (!current) {
      return;
    }

    const changed =
      !lastSeen ||
      lastSeen.status !== current.status ||
      lastSeen.riskScore !== current.riskScore ||
      lastSeen.riskLevel !== current.riskLevel;

    if (changed) {
      lastSeen = {
        status: current.status,
        riskScore: current.riskScore,
        riskLevel: current.riskLevel,
      };
      ws.send(
        JSON.stringify({
          type: "pr-review-progress",
          status: current.status,
          riskScore: current.riskScore,
          riskLevel: current.riskLevel,
        })
      );
    }

    if (TERMINAL_STATUSES.has(current.status)) {
      clearInterval(interval);
      ws.__prReviewProgressInterval = undefined;
      ws.send(JSON.stringify({ type: "pr-review-progress-complete" }));
    }
  }, POLL_INTERVAL_MS);

  ws.__prReviewProgressInterval = interval;
  const closeListener = () => clearInterval(interval);
  ws.__prReviewProgressCloseListener = closeListener;
  ws.on("close", closeListener);
}
