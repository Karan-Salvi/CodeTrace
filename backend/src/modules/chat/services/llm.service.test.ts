import { describe, it, expect, vi } from "vitest";
import { embedQuery, generateChatCompletion, withRetry } from "./llm.service.js";

function retryableError(status: number): Error {
  return Object.assign(new Error("transient failure"), { status });
}

describe("withRetry", () => {
  it("retries a failing function with a retryable status up to the cap then throws", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      throw retryableError(503);
    });

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow("transient failure");
    expect(attempts).toBe(3);
  });

  it("returns the result once the function succeeds within the cap", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw retryableError(429);
      return "ok";
    });

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("stops immediately for a non-retryable status instead of burning the remaining attempts", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      throw retryableError(400);
    });

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow("transient failure");
    expect(attempts).toBe(1);
  });

  it("retries an error with no status at all, since that's a network-level failure (DNS/ECONNRESET/fetch abort), not a known-permanent one", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      throw new Error("fetch failed");
    });

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow("fetch failed");
    expect(attempts).toBe(3);
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
    },
    // gemini-3.6-flash's own documented latency variance (0.5s-40s,
    // verified directly against this API key earlier — an internal
    // "thinking" pass, not a code-side slowdown) exceeds vitest's default
    // 15s test timeout often enough to make this real-API integration
    // test flaky under the full suite. A longer timeout here is the
    // correct fix — the retry/backoff logic being tested is fine; the
    // model itself is just occasionally this slow.
    45000
  );
});
