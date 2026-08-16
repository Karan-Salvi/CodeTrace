import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
});
