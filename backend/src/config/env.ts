import "dotenv/config";
import { z } from "zod";

// "dotenv" was a declared dependency but never actually imported
// anywhere — .env only got loaded when a test runner (vitest) or `tsx
// --env-file` happened to load it independently; `npm run dev` (plain
// `tsx watch src/server.ts`) never read .env at all, silently failing
// with "Invalid environment configuration" for every var. This is the
// one place all env access funnels through (loadEnv() below reads
// process.env), so importing dotenv/config here — before that read —
// is enough to fix every entrypoint at once, no per-script flag needed.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // security.md: cookies carry the refresh token, so CORS must not allow
  // "any origin + credentials" — app.ts previously used cors({ credentials:
  // true }) with no origin, which resolves to the package's default
  // origin: "*" (verified against node_modules/cors/lib/index.js's
  // configureOrigin: falsy/"*" origin always emits a literal
  // "Access-Control-Allow-Origin: *"). That combination is invalid per the
  // CORS spec and browsers reject it client-side today, but it silently
  // breaks any legitimate cross-origin credentialed request and signals no
  // real origin allowlist is configured — the trivial "fix" (origin: true)
  // would reflect literally any origin and actually be exploitable.
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  JINA_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.string().default("gemini"),
  // Google deprecates dated Gemini model ids on a rolling basis (e.g.
  // gemini-2.0-flash returned a hard 404 in production) — hardcoding one
  // means every deprecation is a code deploy. Env-configurable so it's an
  // ops change instead.
  // gemini-3.6-flash is real but currently exhibits wild provider-side
  // latency (0.5s-40s and occasional 503s, verified against this key
  // directly) — gemini-2.5-flash was consistently sub-second in the same
  // test. Override via env if that changes.
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash"),
  EMBEDDING_PROVIDER: z.string().default("gemini"),
  EMBEDDING_MODEL_VERSION: z.string().min(1),
  INTERNAL_API_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }
  return result.data;
}

export const env = loadEnv();
