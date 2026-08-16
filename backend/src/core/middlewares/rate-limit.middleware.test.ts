import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { createRateLimiter, checkRateLimit } from "./rate-limit.middleware.js";
import { redis } from "../../config/redis.js";

describe("createRateLimiter", () => {
  beforeEach(async () => {
    // Clear all ratelimit keys in the test Redis db
    const keys = await redis.keys("ratelimit:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    const keys = await redis.keys("ratelimit:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("allows requests up to the max, then returns 429", async () => {
    const app = express();
    // Simulate requireAuth attaching a user
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req.user = { id: "user-1" } as any;
      next();
    });
    
    app.use(createRateLimiter({ windowMs: 60_000, max: 2, name: "test1" }));
    app.get("/test", (_req, res) => res.status(200).json({ ok: true }));

    // Request 1: allowed
    let res = await request(app).get("/test");
    expect(res.status).toBe(200);

    // Request 2: allowed
    res = await request(app).get("/test");
    expect(res.status).toBe(200);

    // Request 3: blocked
    res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    });
  });

  it("scopes limits per user", async () => {
    const app = express();
    
    app.get("/test/:userId", (req, res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req.user = { id: req.params.userId } as any;
      next();
    }, createRateLimiter({ windowMs: 60_000, max: 1, name: "test2" }), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // User A hits limit
    let res = await request(app).get("/test/user-A");
    expect(res.status).toBe(200);
    res = await request(app).get("/test/user-A");
    expect(res.status).toBe(429);

    // User B is still allowed
    res = await request(app).get("/test/user-B");
    expect(res.status).toBe(200);
  });
});

describe("checkRateLimit", () => {
  beforeEach(async () => {
    const keys = await redis.keys("ratelimit:ws:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    const keys = await redis.keys("ratelimit:ws:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("allows up to max requests within the window, then blocks", async () => {
    const key = "user-ws-1";
    const opts = { windowMs: 60_000, max: 2 };

    expect(await checkRateLimit(key, opts)).toBe(true);
    expect(await checkRateLimit(key, opts)).toBe(true);
    expect(await checkRateLimit(key, opts)).toBe(false);
  });

  it("scopes limits per key independently", async () => {
    const opts = { windowMs: 60_000, max: 1 };

    expect(await checkRateLimit("user-ws-a", opts)).toBe(true);
    expect(await checkRateLimit("user-ws-a", opts)).toBe(false);

    // A different key must not be affected by user-ws-a's exhausted limit
    expect(await checkRateLimit("user-ws-b", opts)).toBe(true);
  });

  it("resets after the window expires", async () => {
    const key = "user-ws-reset";
    const opts = { windowMs: 200, max: 1 };

    expect(await checkRateLimit(key, opts)).toBe(true);
    expect(await checkRateLimit(key, opts)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await checkRateLimit(key, opts)).toBe(true);
  });
});
