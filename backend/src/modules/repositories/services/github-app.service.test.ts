import { describe, it, expect, vi, afterEach } from "vitest";
import { mintInstallationToken } from "./github-app.service.js";

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("header.payload.signature")
  }
}));

describe("mintInstallationToken", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("signs an App JWT and exchanges it for an installation token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "ghs_faketoken123",
        expires_at: "2026-08-14T13:00:00Z",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mintInstallationToken(BigInt(42));

    expect(result.token).toBe("ghs_faketoken123");
    expect(result.expiresAt.toISOString()).toBe("2026-08-14T13:00:00.000Z");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/app/installations/42/access_tokens");
    expect(options.method).toBe("POST");

    const authHeader = options.headers.Authorization as string;
    expect(authHeader).toMatch(/^Bearer /);
    const jwtToken = authHeader.replace("Bearer ", "");
    // a JWT has three dot-separated segments
    expect(jwtToken.split(".")).toHaveLength(3);
  });

  it("throws a descriptive error when GitHub returns a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(mintInstallationToken(BigInt(999))).rejects.toThrow(/installation token/i);
  });
});
