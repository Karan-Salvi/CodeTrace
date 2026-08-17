import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../../config/env.js";

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

// The Gemini SDK throws GoogleGenerativeAIFetchError with a numeric
// `.status` for HTTP-level failures. 429/500/503/504 are transient
// (rate limit / provider-side overload) and worth retrying; anything
// else (400 bad request, 401/403 auth, 404 unknown model) will fail
// identically every time, so retrying it just adds latency before the
// same error.
function isRetryableStatus(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 429 || status === 500 || status === 503 || status === 504;
}

// architecture.md: on LLM/embedding failure, retry with backoff up to a
// capped attempt count, then surface a clear failure rather than hanging.
// Full jitter (random 0..delay, not a fixed exponential value) avoids
// every concurrent request retrying in lockstep and re-triggering the
// same provider-side overload that caused the 503 in the first place.
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const maxDelayMs = opts.maxDelayMs ?? 10_000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts && isRetryableStatus(err)) {
        const delay = Math.min(opts.baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, Math.random() * delay));
      } else if (!isRetryableStatus(err)) {
        break;
      }
    }
  }
  throw lastError;
}

export async function embedQuery(text: string): Promise<number[]> {
  return withRetry(
    async () => {
      const model = client.getGenerativeModel({ model: "gemini-embedding-001" });
      const result = await model.embedContent({
        content: { role: "user", parts: [{ text }] },
        outputDimensionality: 1536,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return result.embedding.values;
    },
    { maxAttempts: 3, baseDelayMs: 500 }
  );
}

export async function generateChatCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    return await withRetry(
      async () => {
        const model = client.getGenerativeModel({
          model: env.GEMINI_CHAT_MODEL,
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text();
      },
      // 500ms, 1s, 2s, 4s base delays (jittered) — enough headroom to ride
      // out a genuinely transient provider-side 503 without leaving the
      // WebSocket caller hanging for minutes.
      { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 8_000 }
    );
  } catch (err) {
    // The raw Google error (endpoint URLs, provider internals) must never
    // reach the end user over the WebSocket — chat-stream.handler.ts sends
    // err.message verbatim to the client.
    console.error("generateChatCompletion failed after retries:", err);
    throw new Error(
      "The AI service is temporarily unavailable. Please try again in a moment."
    );
  }
}
