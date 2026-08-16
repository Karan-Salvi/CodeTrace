import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../../config/env.js";

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

// architecture.md: on LLM/embedding failure, retry with backoff up to a
// capped attempt count, then surface a clear failure rather than hanging.
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, opts.baseDelayMs * 2 ** (attempt - 1)));
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
  return withRetry(
    async () => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      return result.response.text();
    },
    { maxAttempts: 3, baseDelayMs: 500 }
  );
}
