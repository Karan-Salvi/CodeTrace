import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { handleChatMessage } from "./handlers/chat-stream.handler.js";
import { handleProgressSubscription } from "./handlers/index-progress.handler.js";
import { handlePrReviewProgressSubscription } from "./handlers/pr-review-progress.handler.js";

export function createWebSocketGateway(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (data) => {
      const raw = data.toString();

      let parsed: { type?: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      const handler =
        parsed.type === "subscribe-progress"
          ? handleProgressSubscription
          : parsed.type === "subscribe-pr-review-progress"
            ? handlePrReviewProgressSubscription
            : handleChatMessage;

      handler(ws, raw).catch((err) => {
        ws.send(JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Unknown error" }));
      });
    });
  });

  return wss;
}
