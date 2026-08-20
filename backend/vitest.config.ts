import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Defensive, in addition to vitest's own default dist/ exclusion — a
    // stale `dist/` build artifact previously got picked up alongside the
    // real src/ tests (compiled, out-of-date .test.js files running
    // against the current src/ implementation, producing confusing
    // failures that had nothing to do with the actual source code).
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
});
