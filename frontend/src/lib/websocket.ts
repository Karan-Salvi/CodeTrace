import { getAccessToken } from "./auth";
import type { Citation, RepositoryStatus, PrReviewStatus, RiskLevel } from "../types";

const WS_BASE_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000";

type MessageHandler = (payload: unknown) => void;

// Real backend contract (websocket/gateway.ts + both handlers,
// backend/src/websocket/handlers/*.ts) — every message needs a `type`
// field or the gateway silently misroutes it to the chat handler
// (gateway.ts: only "subscribe-progress" is special-cased, everything
// else falls through to chat). There is no "CHAT_MESSAGE" /
// "CHAT_TOKEN" / "INDEX_PROGRESS" protocol on the server — those never
// existed; using them meant every WebSocket message silently failed or
// misrouted.
export interface ProgressMessage {
  type: "progress";
  status: RepositoryStatus;
  filesIndexed: number;
  chunksIndexed: number;
}

export interface ProgressCompleteMessage {
  type: "progress-complete";
}

export interface PrReviewProgressMessage {
  type: "pr-review-progress";
  status: PrReviewStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
}

export interface PrReviewProgressCompleteMessage {
  type: "pr-review-progress-complete";
}

export interface ChatCompleteMessage {
  type: "chat:complete";
  answer: string;
  citations: Citation[];
}

export interface WsErrorMessage {
  type: "error";
  message: string;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private pendingSends: string[] = [];

  connect() {
    const token = getAccessToken();
    if (!token || this.ws || this.isConnecting) return;

    this.isConnecting = true;
    // No query-string token here: the backend's WebSocket gateway
    // (websocket/gateway.ts) doesn't read one — it routes purely on
    // each message's `type` field and verifies auth per-message via a
    // `token` field inside the message body (see send() below, and
    // both handlers' `verifyAccessToken(message.token)` calls). A
    // handshake-URL token would just be dead weight that additionally
    // exposes the access token in places URLs tend to get logged
    // (proxies, server access logs) for no actual benefit.
    this.ws = new WebSocket(`${WS_BASE_URL}/ws`);

    this.ws.onopen = () => {
      this.isConnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      const queued = this.pendingSends;
      this.pendingSends = [];
      queued.forEach((msg) => this.ws?.send(msg));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type) {
          this.emit(data.type, data);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.isConnecting = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      // onclose will fire after this
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
  }

  send(type: string, payload: unknown) {
    const msg = JSON.stringify({ type, ...(payload as Record<string, unknown>) });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      // Handshake still in flight (connect() and subscribeToProgress()/
      // sendChatMessage() are called back-to-back from the same effect,
      // before onopen fires) — queue it and flush once the socket opens
      // instead of silently dropping it.
      this.pendingSends.push(msg);
    } else {
      console.warn("WebSocket is not connected. Message dropped:", type);
    }
  }

  // Every server-side handler independently verifies the access token
  // carried in each message's own `token` field (index-progress.handler.ts
  // / chat-stream.handler.ts, both call verifyAccessToken(message.token))
  // — it is NOT read from any connection-level/query-string auth. These
  // two helpers exist so callers can't accidentally omit that field or
  // use the wrong type/field names again.
  subscribeToProgress(repositoryId: string) {
    const token = getAccessToken();
    if (!token) return;
    this.send("subscribe-progress", { repositoryId, token });
  }

  subscribeToPrReviewProgress(pullRequestId: string) {
    const token = getAccessToken();
    if (!token) return;
    this.send("subscribe-pr-review-progress", { pullRequestId, token });
  }

  sendChatMessage(repositoryId: string, conversationId: string, question: string) {
    const token = getAccessToken();
    if (!token) return;
    this.send("chat", { repositoryId, conversationId, question, token });
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.delete(handler);
      if (typeHandlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  private emit(type: string, payload: unknown) {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => handler(payload));
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer && getAccessToken()) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000); // Reconnect after 3 seconds
    }
  }
}

export const wsClient = new WebSocketClient();
