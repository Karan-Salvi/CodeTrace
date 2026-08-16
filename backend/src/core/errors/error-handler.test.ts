import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { AppError } from "./app-error.js";
import { errorHandler } from "./error-handler.js";
import { asyncHandler } from "../utils/async-handler.js";

describe("errorHandler", () => {
  it("converts an AppError into the correct status and body", async () => {
    const app = express();
    app.get(
      "/boom",
      asyncHandler(async () => {
        throw AppError.notFound("Repository not found");
      })
    );
    app.use(errorHandler);

    const res = await request(app).get("/boom");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Repository not found" },
    });
  });

  it("converts an unknown error into a 500", async () => {
    const app = express();
    app.get(
      "/boom",
      asyncHandler(async () => {
        throw new Error("unexpected");
      })
    );
    app.use(errorHandler);

    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
