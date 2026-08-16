import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { requireAuth } from "./auth.middleware.js";
import { env } from "../../config/env.js";
import { errorHandler } from "../errors/error-handler.js";

describe("requireAuth", () => {
  const app = express();
  app.use(requireAuth);
  app.get("/protected", (req, res) => res.json({ userId: req.user?.id }));
  app.use(errorHandler);

  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/protected").set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign({ userId: "u1", sessionId: "s1" }, env.JWT_ACCESS_SECRET, {
      expiresIn: -10,
    });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it("accepts a valid token and attaches req.user", async () => {
    const token = jwt.sign({ userId: "u1", sessionId: "s1" }, env.JWT_ACCESS_SECRET, {
      expiresIn: 900,
    });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("u1");
  });
});
