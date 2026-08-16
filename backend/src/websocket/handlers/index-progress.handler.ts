import type { WebSocket } from "ws";
import { verifyAccessToken } from "../../modules/auth/services/session.service.js";
import { prisma } from "../../database/client.js";

interface SubscribeProgressMessage {
  type: "subscribe-progress";
  repositoryId: string;
  token: string;
}

const POLL_INTERVAL_MS = 500;
const TERMINAL_STATUSES = new Set(["INDEXED", "FAILED"]);

interface LastSeen {
  status: string;
  filesIndexed: number;
  chunksIndexed: number;
}

interface WebSocketWithProgressState extends WebSocket {
  __progressInterval?: NodeJS.Timeout;
  __progressCloseListener?: () => void;
}

export async function handleProgressSubscription(
  wsInput: WebSocket,
  raw: string
): Promise<void> {
  const ws = wsInput as WebSocketWithProgressState;
  let message: SubscribeProgressMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    return;
  }

  if (message.type !== "subscribe-progress") return;

  const payload = verifyAccessToken(message.token);
  if (!payload) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    return;
  }

  const repository = await prisma.repository.findUnique({ where: { id: message.repositoryId } });
  if (!repository || repository.userId !== payload.userId) {
    ws.send(JSON.stringify({ type: "error", message: "Repository not found" }));
    return;
  }

  // A client re-sending subscribe-progress on the same connection (e.g.
  // switching which repository it watches) must not leak the previous
  // interval — only one active poll per socket.
  if (ws.__progressInterval) {
    clearInterval(ws.__progressInterval);
  }
  // Same for the "close" listener registered below: without removing the
  // prior one first, N resubscribes on one socket register N listeners
  // that all reference already-cleared intervals (harmless individually,
  // but they never get removed) — confirmed via a real Node
  // MaxListenersExceededWarning after 11 resubscribes on one socket, and
  // the listener array grows unboundedly for the connection's lifetime.
  if (ws.__progressCloseListener) {
    ws.off("close", ws.__progressCloseListener);
  }

  let lastSeen: LastSeen | null = null;

  const interval = setInterval(async () => {
    const current = await prisma.repository.findUnique({
      where: { id: message.repositoryId },
      select: { status: true, filesIndexed: true, chunksIndexed: true },
    });
    if (!current) {
      clearInterval(interval);
      return;
    }

    const changed =
      !lastSeen ||
      lastSeen.status !== current.status ||
      lastSeen.filesIndexed !== current.filesIndexed ||
      lastSeen.chunksIndexed !== current.chunksIndexed;

    if (changed) {
      lastSeen = {
        status: current.status,
        filesIndexed: current.filesIndexed,
        chunksIndexed: current.chunksIndexed,
      };
      ws.send(
        JSON.stringify({
          type: "progress",
          status: current.status,
          filesIndexed: current.filesIndexed,
          chunksIndexed: current.chunksIndexed,
        })
      );
    }

    if (TERMINAL_STATUSES.has(current.status)) {
      clearInterval(interval);
      ws.__progressInterval = undefined;
      ws.send(JSON.stringify({ type: "progress-complete" }));
    }
  }, POLL_INTERVAL_MS);

  ws.__progressInterval = interval;
  const closeListener = () => clearInterval(interval);
  ws.__progressCloseListener = closeListener;
  ws.on("close", closeListener);
}
