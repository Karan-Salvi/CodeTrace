import { describe, it, expect, beforeEach } from "vitest";

describe("env config", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5433/db";
    process.env.REDIS_URL = "redis://localhost:6380";
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
    process.env.GITHUB_CLIENT_ID = "id";
    process.env.GITHUB_CLIENT_SECRET = "secret";
    process.env.GITHUB_APP_ID = "1";
    process.env.GITHUB_APP_PRIVATE_KEY = "key";
    process.env.GITHUB_WEBHOOK_SECRET = "whsecret";
    process.env.GEMINI_API_KEY = "gk";
    process.env.EMBEDDING_MODEL_VERSION = "gemini-embedding-001-1536";
  });

  it("parses valid env vars", async () => {
    const { loadEnv } = await import("./env.js");
    const env = loadEnv();
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.EMBEDDING_MODEL_VERSION).toBe("gemini-embedding-001-1536");
    expect(env.PORT).toBe(3000);
  });

  it("throws when a required var is missing", async () => {
    delete process.env.DATABASE_URL;
    const { loadEnv } = await import("./env.js");
    expect(() => loadEnv()).toThrow();
  });
});
