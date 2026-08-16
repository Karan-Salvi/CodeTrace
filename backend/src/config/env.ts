import { z } from "zod";

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
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.string().default("gemini"),
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
