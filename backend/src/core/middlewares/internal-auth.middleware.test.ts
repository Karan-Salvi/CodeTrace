import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireInternalAuth } from "./internal-auth.middleware.js";
import { errorHandler } from "../errors/error-handler.js";
import { env } from "../../config/env.js";

describe("requireInternalAuth", () => {
  const app = express();
  app.use(requireInternalAuth);
  app.get("/internal/ping", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  it("rejects a request with no internal-secret header", async () => {
    const res = await request(app).get("/internal/ping");
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await request(app).get("/internal/ping").set("x-internal-secret", "wrong-value");
    expect(res.status).toBe(401);
  });

  it("accepts a request with the correct secret", async () => {
    const res = await request(app)
      .get("/internal/ping")
      .set("x-internal-secret", env.INTERNAL_API_SECRET);
    expect(res.status).toBe(200);
  });
});
