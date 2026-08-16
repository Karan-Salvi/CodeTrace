import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

describe("createApp CORS configuration", () => {
  const app = createApp();

  it("never pairs a wildcard Access-Control-Allow-Origin with credentials", async () => {
    // Regression: cors({ credentials: true }) with no origin resolves to
    // the cors package's default origin: "*" (verified against
    // node_modules/cors/lib/index.js's configureOrigin — a falsy/"*"
    // origin always emits a literal "Access-Control-Allow-Origin: *").
    // That combination is invalid per the CORS spec: it silently breaks
    // every legitimate cross-origin credentialed request (the refresh-
    // token cookie flow) and the naive fix (origin: true) would instead
    // reflect literally any origin, which real browsers DO accept
    // alongside credentials — actually exploitable.
    const res = await request(app).get("/health").set("Origin", "https://evil.example.com");

    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("reflects the configured CORS_ORIGIN for the allowed frontend origin", async () => {
    const res = await request(app).get("/health").set("Origin", env.CORS_ORIGIN);

    expect(res.headers["access-control-allow-origin"]).toBe(env.CORS_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
