import { describe, it, expect, vi } from "vitest";
import { fetchFileAtRef } from "./github-file-content.service.js";

function base64Response(content: string) {
  return {
    ok: true,
    json: async () => ({ content: Buffer.from(content, "utf-8").toString("base64"), encoding: "base64" }),
  };
}

describe("fetchFileAtRef", () => {
  it("returns decoded content for a normal text file", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(base64Response("export function foo() {}\n")));

    const result = await fetchFileAtRef("token123", "octocat", "hello-world", "src/foo.ts", "abc123");

    expect(result).toEqual({ content: "export function foo() {}\n", binary: false });
    vi.unstubAllGlobals();
  });

  it("calls the GitHub contents API with the correct URL and headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(base64Response("content"));
    vi.stubGlobal("fetch", mockFetch);

    await fetchFileAtRef("token123", "octocat", "hello-world", "src/foo.ts", "abc123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/octocat/hello-world/contents/src%2Ffoo.ts?ref=abc123",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token123" }),
      })
    );
    vi.unstubAllGlobals();
  });

  it("returns null when the file doesn't exist at that ref (404) — the added/removed-file case", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));

    const result = await fetchFileAtRef("token123", "octocat", "hello-world", "src/new-file.ts", "abc123");

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it("marks a file as tooLarge when GitHub omits content/encoding for it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ encoding: "none" }) })
    );

    const result = await fetchFileAtRef("token123", "octocat", "hello-world", "assets/huge.bin", "abc123");

    expect(result).toEqual({ content: "", tooLarge: true });
    vi.unstubAllGlobals();
  });

  it("returns real empty content (not tooLarge) for a genuinely empty 0-byte file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: "", encoding: "base64" }) })
    );

    const result = await fetchFileAtRef("token123", "octocat", "hello-world", "src/__init__.py", "abc123");

    expect(result).toEqual({ content: "", binary: false });
    vi.unstubAllGlobals();
  });

  it("marks a file as binary when the decoded content contains a NUL byte", async () => {
    const binaryContent = "PNG\0\0\0IHDR";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(base64Response(binaryContent)));

    const result = await fetchFileAtRef("token123", "octocat", "hello-world", "logo.png", "abc123");

    expect(result?.binary).toBe(true);
    vi.unstubAllGlobals();
  });

  it("throws with the GitHub error message on any other non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: "API rate limit exceeded" }) })
    );

    await expect(
      fetchFileAtRef("token123", "octocat", "hello-world", "src/foo.ts", "abc123")
    ).rejects.toThrow(/API rate limit exceeded/);
    vi.unstubAllGlobals();
  });
});
