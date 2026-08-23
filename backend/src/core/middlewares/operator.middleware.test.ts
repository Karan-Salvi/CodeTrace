import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { requireOperator } from "./operator.middleware.js";
import { env } from "../../config/env.js";
import { errorHandler } from "../errors/error-handler.js";

describe("requireOperator", () => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: "user-123", sessionId: "s1" };
    next();
  });
  app.use(requireOperator);
  app.get("/usage/summary", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  beforeEach(() => {
    env.OPERATOR_USER_ID = "operator-456";
  });

  it("allows the request through if the user ID matches the operator ID", async () => {
    env.OPERATOR_USER_ID = "user-123";
    const res = await request(app).get("/usage/summary");
    expect(res.status).toBe(200);
  });

  it("rejects with 403 if the user ID does not match the operator ID", async () => {
    const res = await request(app).get("/usage/summary");
    expect(res.status).toBe(403);
  });

  it("rejects with 403 if env.OPERATOR_USER_ID is unset", async () => {
    env.OPERATOR_USER_ID = undefined;
    const res = await request(app).get("/usage/summary");
    expect(res.status).toBe(403);
  });
});
