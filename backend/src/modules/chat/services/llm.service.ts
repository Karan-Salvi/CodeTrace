import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../../config/env.js";

// Round-robin across all configured keys so embedding/chat calls spread
// over several independent per-minute quotas instead of hammering one
// (mirrors worker/src/embedding/embedder.py's key pool).
const keyPool = [
  env.GEMINI_API_KEY,
  ...env.GEMINI_API_KEYS_EXTRA.split(",").map((k) => k.trim()).filter(Boolean),
];
const uniqueKeyPool = [...new Set(keyPool)];
const clients = uniqueKeyPool.map((key) => new GoogleGenerativeAI(key));
let nextClientIndex = 0;

function getClient(): GoogleGenerativeAI {
  const client = clients[nextClientIndex];
  nextClientIndex = (nextClientIndex + 1) % clients.length;
  return client;
}

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);

// The Gemini SDK throws GoogleGenerativeAIFetchError with a numeric
// `.status` for HTTP-level failures. 429/500/503/504 are transient
// (rate limit / provider-side overload) and worth retrying; any other
// known status (400 bad request, 401/403 auth, 404 unknown model) will
// fail identically every time, so retrying it just adds latency before
// the same error. A plain network-level error (DNS failure, ECONNRESET,
// a fetch abort) has no `.status` at all — that used to fall into the
// same "don't retry" bucket as a real 400, even though it's exactly the
// kind of transient failure retry logic exists for. Treated as retryable
// here instead.
function isRetryableStatus(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true;
  return RETRYABLE_STATUSES.has(status);
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
  try {
    return await withRetry(
      async () => {
        const model = getClient().getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent({
          content: { role: "user", parts: [{ text }] },
          outputDimensionality: 1536,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return result.embedding.values;
      },
      { maxAttempts: 3, baseDelayMs: 500 }
    );
  } catch (err) {
    // Same reasoning as generateChatCompletion: chat.service.ts and
    // pr-review.service.ts both call embedQuery directly on paths that
    // reach the client (WebSocket chat, PR-review write-back) — the raw
    // Google SDK error must not leak through either one.
    console.error("embedQuery failed after retries:", err);
    throw new Error("The AI service is temporarily unavailable. Please try again in a moment.");
  }
}

export interface ChatCompletionResult {
  text: string;
  usage: { promptTokens: number; candidatesTokens: number; totalTokens: number };
}

export async function generateChatCompletion(systemPrompt: string, userPrompt: string): Promise<ChatCompletionResult> {
  try {
    return await withRetry(
      async () => {
        const model = getClient().getGenerativeModel({
          model: env.GEMINI_CHAT_MODEL,
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        const usageMetadata = result.response.usageMetadata;
        return {
          text: result.response.text(),
          usage: {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidatesTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
          },
        };
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
