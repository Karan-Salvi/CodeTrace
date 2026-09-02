# CodeTrace backend — production image.
# Repo-root build context required: npm workspaces resolve
# @codetrace/shared-types only from the root, not from backend/ alone
# (deployment.md).

FROM node:22-slim AS builder

WORKDIR /build

COPY . .
RUN npm ci

RUN DATABASE_URL=postgresql://dummy npm run prisma:generate --workspace=backend
RUN npm run build --workspace=shared/types
RUN npm run build --workspace=backend

FROM node:22-slim AS runtime

RUN groupadd --system backend && useradd --system --gid backend --create-home backend

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
# The npm-workspace symlink at node_modules/@codetrace/shared-types
# (-> ../../shared/types) does not survive this COPY meaningfully — its
# relative target (shared/types at the repo root) isn't copied into this
# stage, so the symlink would point nowhere. Remove it and materialize
# the compiled package as a real directory instead — simpler and more
# robust than trying to preserve the workspace symlink across stages.
RUN rm -rf ./node_modules/@codetrace
COPY --from=builder /build/shared/types/dist ./node_modules/@codetrace/shared-types/dist
COPY --from=builder /build/shared/types/package.json ./node_modules/@codetrace/shared-types/package.json
COPY --from=builder /build/backend/dist ./dist
COPY --from=builder /build/backend/package.json ./package.json

# scripts/migrate.sh and CI both run `prisma migrate deploy` /
# `apply-concurrent-migrations.ts` INSIDE this container — both need
# prisma.config.ts + prisma/schema.prisma + prisma/migrations present at
# runtime, not just baked into the (discarded) builder stage. Without
# this, `prisma migrate deploy` fails outright in the real container
# ("Could not find Prisma Schema") — confirmed by a real `docker run`
# against this image before this fix existed.
COPY --from=builder /build/backend/prisma.config.ts ./prisma.config.ts
COPY --from=builder /build/backend/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /build/backend/prisma/migrations ./prisma/migrations

# scripts/migrate.sh runs `npx tsx scripts/apply-concurrent-migrations.ts`
# (raw TypeScript, not compiled) so the SAME command works identically in
# both this image and backend/Dockerfile.dev's bind-mounted dev container
# — copying just this one script (not the rest of scripts/, which has
# dev-only fixtures/tests unrelated to production) avoids migrate.sh
# needing environment-specific branching logic.
COPY --from=builder /build/backend/scripts/apply-concurrent-migrations.ts ./scripts/apply-concurrent-migrations.ts

USER backend

ENV NODE_ENV=production
EXPOSE 3000

STOPSIGNAL SIGTERM

CMD ["node", "dist/src/server.js"]
