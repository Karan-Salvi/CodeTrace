import { describe, it, expect, vi } from "vitest";
import { embedQuery, generateChatCompletion, withRetry } from "./llm.service.js";

describe("withRetry", () => {
  it("retries a failing function up to the cap then throws", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      throw new Error("transient failure");
    });

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow("transient failure");
    expect(attempts).toBe(3);
  });

  it("returns the result once the function succeeds within the cap", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw new Error("transient failure");
      return "ok";
    });

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});

describe("embedQuery / generateChatCompletion (integration, requires GEMINI_API_KEY)", () => {
  const shouldSkip = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("dummy") || process.env.GEMINI_API_KEY === "enc";
  it.skipIf(shouldSkip)(
    "embedQuery returns a 1536-dim vector",
    async () => {
      const vector = await embedQuery("what does handleAuthError do");
      expect(vector).toHaveLength(1536);
    }
  );

  it.skipIf(shouldSkip)(
    "generateChatCompletion returns non-empty text",
    async () => {
      const text = await generateChatCompletion("You are a helpful assistant.", "Say hello in one word.");
      expect(text.length).toBeGreaterThan(0);
    }
  );
});
