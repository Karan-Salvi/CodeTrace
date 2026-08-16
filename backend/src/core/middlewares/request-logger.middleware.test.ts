import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requestLogger } from "./request-logger.middleware.js";

describe("requestLogger", () => {
  it("assigns a unique req.id and exposes it via header", async () => {
    const app = express();
    app.use(requestLogger);
    app.get("/ping", (req, res) => {
      res.json({ id: req.id });
    });

    const res = await request(app).get("/ping");
    expect(res.body.id).toBeTruthy();
    expect(res.headers["x-request-id"]).toBe(res.body.id);
  });

  it("reuses an inbound x-request-id header instead of generating a new one", async () => {
    const app = express();
    app.use(requestLogger);
    app.get("/ping", (req, res) => res.json({ id: req.id }));

    const res = await request(app).get("/ping").set("x-request-id", "fixed-id-123");
    expect(res.body.id).toBe("fixed-id-123");
  });
});
