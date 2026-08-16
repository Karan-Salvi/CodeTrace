import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../../../app.js";
import { prisma } from "../../../database/client.js";
import { redis } from "../../../config/redis.js";

describe("GET /health*", () => {
  const app = createApp();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /health returns healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("GET /health/db returns healthy against the real database", async () => {
    const res = await request(app).get("/health/db");
    expect(res.status).toBe(200);
    expect(res.body.database).toBe("healthy");
  });

  it("GET /health/redis returns healthy against the real redis", async () => {
    const res = await request(app).get("/health/redis");
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe("healthy");
  });

  it("GET /health/db reports unhealthy (503) when the database is actually unreachable", async () => {
    // Deployment (deployment.md) gates every deploy on this endpoint —
    // it must actually reflect DB connectivity, not just always return
    // 200. Proven by forcing the real failure path, not by reading the
    // code and assuming the try/catch works.
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/health/db");
    expect(res.status).toBe(503);
    expect(res.body.database).toBe("unhealthy");
  });

  it("GET /health/redis reports unhealthy (503) when redis is actually unreachable", async () => {
    vi.spyOn(redis, "ping").mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/health/redis");
    expect(res.status).toBe(503);
    expect(res.body.redis).toBe("unhealthy");
  });

  it("GET /health/redis reports unhealthy (503) when redis responds but not with PONG", async () => {
    vi.spyOn(redis, "ping").mockResolvedValueOnce("WRONG" as "PONG");

    const res = await request(app).get("/health/redis");
    expect(res.status).toBe(503);
    expect(res.body.redis).toBe("unhealthy");
  });
});
