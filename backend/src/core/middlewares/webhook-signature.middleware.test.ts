import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./webhook-signature.middleware.js";
import { errorHandler } from "../errors/error-handler.js";
import { env } from "../../config/env.js";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request & { rawBody?: Buffer }).rawBody = buf; } }));
  app.use(verifyWebhookSignature);
  app.post("/webhooks/github", (req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  it("rejects a request with no signature header", async () => {
    const res = await request(app).post("/webhooks/github").send({ a: 1 });
    expect(res.status).toBe(401);
  });

  it("rejects a request with a wrong signature", async () => {
    const res = await request(app)
      .post("/webhooks/github")
      .set("x-hub-signature-256", "sha256=deadbeef")
      .send({ a: 1 });
    expect(res.status).toBe(401);
  });

  it("accepts a request with a correctly computed signature", async () => {
    const body = JSON.stringify({ a: 1 });
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", sign(body))
      .send(body);
    expect(res.status).toBe(200);
  });
});
