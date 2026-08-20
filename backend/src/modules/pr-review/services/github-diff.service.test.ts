import { describe, it, expect, vi } from "vitest";
import { parseUnifiedDiff, getPrDiff } from "./github-diff.service.js";

describe("parseUnifiedDiff", () => {
  it("extracts a ChangedLineRange from a single added hunk", () => {
    const patch = [
      "@@ -0,0 +1,3 @@",
      "+function foo() {",
      "+  return 1;",
      "+}",
    ].join("\n");

    const result = parseUnifiedDiff("src/foo.ts", patch);

    expect(result.ranges).toEqual([{ filePath: "src/foo.ts", startLine: 1, endLine: 3 }]);
  });

  it("extracts one ChangedLineRange per hunk across multiple hunks", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " function foo() {",
      "+  console.log('added');",
      "   return 1;",
      " }",
      "@@ -10,2 +11,3 @@",
      " function bar() {",
      "+  console.log('also added');",
      " }",
    ].join("\n");

    const result = parseUnifiedDiff("src/foo.ts", patch);

    expect(result.ranges).toEqual([
      { filePath: "src/foo.ts", startLine: 1, endLine: 4 },
      { filePath: "src/foo.ts", startLine: 11, endLine: 13 },
    ]);
  });

  it("produces zero ranges for a hunk that only deletes lines", () => {
    const patch = ["@@ -5,3 +5,0 @@", "-function unused() {", "-  return 1;", "-}"].join("\n");

    const result = parseUnifiedDiff("src/foo.ts", patch);

    expect(result.ranges).toEqual([]);
  });

  it("maps new-file line numbers to GitHub review-comment position, counting every line after the first hunk header", () => {
    const patch = [
      "@@ -1,2 +1,3 @@",
      " function foo() {",
      "+  return 1;",
      " }",
    ].join("\n");
    // lines[0] = "@@ ..." header (excluded, position 0/unused)
    // lines[1] = " function foo() {" -> newLine 1 -> position 1
    // lines[2] = "+  return 1;"      -> newLine 2 -> position 2
    // lines[3] = " }"                -> newLine 3 -> position 3

    const result = parseUnifiedDiff("src/foo.ts", patch);

    expect(result.positionByNewLine.get(1)).toBe(1);
    expect(result.positionByNewLine.get(2)).toBe(2);
    expect(result.positionByNewLine.get(3)).toBe(3);
  });

  it("ignores a '\\ No newline at end of file' marker line instead of treating it as real content", () => {
    const patch = [
      "@@ -1,2 +1,2 @@",
      " function foo() {",
      "-  return 1;",
      "+  return 2;",
      "\\ No newline at end of file",
    ].join("\n");

    const result = parseUnifiedDiff("src/foo.ts", patch);

    // Without the fix, the marker line (doesn't start with "-") would be
    // treated as a real context/addition line: consume line 3 (a line
    // that doesn't exist) and shift every subsequent lookup off by one.
    expect(result.positionByNewLine.get(1)).toBe(1);
    expect(result.positionByNewLine.get(2)).toBe(3);
    expect(result.positionByNewLine.has(3)).toBe(false);
  });

  it("does not add a position entry for a pure deletion line", () => {
    const patch = ["@@ -1,2 +1,1 @@", " function foo() {", "-  return 1;"].join("\n");

    const result = parseUnifiedDiff("src/foo.ts", patch);

    expect(result.positionByNewLine.size).toBe(1);
    expect(result.positionByNewLine.get(1)).toBe(1);
  });
});

describe("getPrDiff", () => {
  it("fetches the compare diff, skips removed files, and assembles ranges + positions across files", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            filename: "src/foo.ts",
            status: "modified",
            patch: "@@ -1,2 +1,3 @@\n function foo() {\n+  return 1;\n }",
          },
          {
            filename: "src/deleted.ts",
            status: "removed",
            patch: "@@ -1,3 +0,0 @@\n-function gone() {\n-  return 1;\n-}",
          },
          {
            filename: "src/binary.png",
            status: "modified",
            // GitHub omits `patch` entirely for binary/too-large files
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await getPrDiff("token123", "octocat", "hello-world", "base123", "head456");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/octocat/hello-world/compare/base123...head456",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token123" }),
      })
    );
    expect(result.changedRanges).toEqual([{ filePath: "src/foo.ts", startLine: 1, endLine: 3 }]);
    expect(result.positionByFileAndLine.has("src/foo.ts")).toBe(true);
    expect(result.positionByFileAndLine.has("src/deleted.ts")).toBe(false);
    expect(result.positionByFileAndLine.has("src/binary.png")).toBe(false);

    vi.unstubAllGlobals();
  });

  it("throws with the GitHub error message when the compare request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "No common ancestor" }),
      })
    );

    await expect(
      getPrDiff("token123", "octocat", "hello-world", "base123", "head456")
    ).rejects.toThrow(/No common ancestor/);

    vi.unstubAllGlobals();
  });
});
