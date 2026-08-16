import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: connection URL lives here, not in schema.prisma.
// Env-var-only per docs/architecture.md — never a hardcoded hostname.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
