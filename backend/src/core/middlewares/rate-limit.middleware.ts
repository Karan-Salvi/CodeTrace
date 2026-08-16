import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { redis } from "../../config/redis.js";
import { sendError } from "../utils/response.js";

export function createRateLimiter(opts: { windowMs: number; max: number; name: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? "anonymous",
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) =>
        redis.call(command, ...args) as Promise<RedisReply>,
      prefix: `ratelimit:${opts.name}:`,
    }),
    handler: (_req, res) => {
      sendError(res, 429, "RATE_LIMITED", "Too many requests");
    },
  });
}

// express-rate-limit's RedisStore is coupled to Express req/res and
// can't be reused for the WebSocket chat-message path
// (websocket/handlers/chat-stream.handler.ts) — that's the actual
// per-message LLM-cost driver security.md's rate-limiting requirement
// is aimed at (chat.routes.ts's HTTP rate limiter only covers
// conversation *creation*, not individual messages sent within one).
// Plain Redis fixed-window counter: INCR the key, set an expiry only on
// the first increment in the window (NX so a late straggler in the same
// window can't reset the TTL and extend it indefinitely).
export async function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number }
): Promise<boolean> {
  const redisKey = `ratelimit:ws:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, opts.windowMs, "NX");
  }
  return count <= opts.max;
}
