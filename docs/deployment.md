# Deployment

## Target (MVP)

Single AWS EC2 instance, all services via
`infra/docker-compose.single-vm.yml`:

```
                    AWS EC2
                       |
                    Nginx
                       |
             +---------+---------+
             |                   |
          Frontend            Backend API
                                   |
                          +--------+--------+
                          |                 |
                        Redis          Python Worker
                                             |
                                             v
                                        PostgreSQL
                                        + pgvector
```

Instance sizing: minimum 2 GB RAM / 1 vCPU (t3.small equivalent). A 1 GB
instance is workable for idle/light-demo use with swap configured and
per-container memory limits set, but risks OOM-killing the worker mid
embedding-batch during a real indexing run — since this project needs to
survive live demos, 2 GB+ is the actual target, not the minimum-viable one.

New AWS accounts (created after July 2025) receive up to $200 in credits
over a 6-month/credit-exhaustion window rather than 12 months of free EC2 —
budget the instance choice accordingly and set a billing alarm.

## Environment configuration

Per-service `.env.*.example` files in `infra/env/` — each service only
declares the variables it actually needs:

- `frontend`: `VITE_API_URL` only.
- `backend`: `DATABASE_URL`, `REDIS_URL`, GitHub App credentials,
  webhook secret, LLM/embedding API keys.
- `worker`: `DATABASE_URL`, `REDIS_URL`, embedding API key. No GitHub App
  credentials — the worker never talks to GitHub directly.

No hostnames are ever hardcoded (`redis`, `postgres`) — always read from
environment variables. This is what makes the single-VM → split-VM path a
configuration change rather than a rewrite.

## First deploy on a fresh VM (TLS bootstrap order matters)

nginx's config requires real cert files to exist before it can start —
so the very first deploy on a fresh VM must obtain the certificate
*before* the nginx service ever runs:

1. `docker compose -f infra/docker-compose.single-vm.yml up -d postgres redis backend worker frontend`
   (everything except nginx — port 80 must stay free for the next step)
2. `DOMAIN=your.domain EMAIL=you@example.com ./scripts/init-tls.sh`
3. `DOMAIN=your.domain ./scripts/render-nginx-config.sh`
4. `docker compose -f infra/docker-compose.single-vm.yml up -d nginx`
5. `./scripts/migrate.sh`
6. Verify: `curl -sf https://your.domain/health`

Every deploy after the first only needs steps 3-6 (cert already exists,
nginx can start normally) — plus a cron job running
`./scripts/renew-tls.sh` periodically (see that script's own header
comment for a ready-to-use crontab line).

## Backups

The single VM has no redundancy — a disk failure loses every repo,
chunk, embedding, and PR review permanently unless backed up elsewhere.
`./scripts/backup-db.sh` dumps Postgres (gzip-compressed, timestamped)
into a local `backups/` directory and prunes anything older than
`RETENTION_DAYS` (default 14) — wire it into cron (see the script's own
header comment for a ready-to-use crontab line). `backups/` is gitignored
and local-only; copying dumps off the VM (S3, rsync to another host,
etc.) is a natural next step once a storage target is picked, not built
here.

`./scripts/restore-db.sh <backup-file> [compose-file]` restores one —
destructive (drops and recreates the `codetrace` database), so it
requires an explicit `CONFIRM=yes` on top of the backup-file argument.
Re-run `./scripts/migrate.sh` after restoring to be safe. Both scripts
were verified end to end against a real dump of real data (backup →
restore into a throwaway database → row counts and the `vector` extension
both confirmed identical to the source) before being trusted here.

## Why this matters for future scaling

`infra/` also ships (currently unused) `docker-compose.backend.yml` and
`docker-compose.worker.yml`, so the worker can move to its own VM later
without touching application code — only:

1. Point `worker`'s `DATABASE_URL`/`REDIS_URL` at the backend VM's
   private IP instead of a Docker-internal hostname.
2. Put both VMs in the same AWS VPC / private subnet, with security groups
   restricting Postgres/Redis access to just those two instances — never
   expose either publicly.
3. Enable auth on Redis (`requirepass`) and Postgres, even though it isn't
   strictly required on a single VM — treated as required from day one
   specifically so this isn't a retrofit.

Migrations remain exclusively a backend responsibility in either topology
(`scripts/migrate.sh`) — the worker never runs `prisma migrate`.

## CI/CD

```
Pull Request
    v
Lint
    v
Unit tests
    v
Integration tests
    v
Retrieval eval (smoke-test config, not full benchmark)
    v
Build

push to main, in the SAME workflow run (.github/workflows/ci.yml's
`deploy` job, `needs: [js, worker]` — one pipeline, not a second
workflow_run-linked file; never runs on a PR)
    v
Deploy: SSH into the VM, git pull, `docker compose up -d --build` rebuilds
images ON the VM directly — no separate registry/push step for this
single-VM MVP
    v
scripts/migrate.sh
    v
Health check (the deploy job's actual pass/fail gate, not just "the
containers started")
```

Requires these set in the repo (Settings -> Secrets and variables ->
Actions) before the `deploy` job can run at all — none exist by default:
- Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- Variables: `DEPLOY_PATH` (absolute path to the cloned repo on the VM),
  `DEPLOY_DOMAIN`

Build order matters: `shared/types` must build/type-check before `backend`
or `frontend`, since both depend on it — enforced as explicit sequential
steps in `ci.yml`, not left to job-scheduling luck.

## Health checks

`GET /health`, `GET /health/db`, `GET /health/redis` on the backend —
returns per-dependency status, used by the deploy pipeline (and, if
services are ever split across VMs, by whatever is checking service
liveness across the network) to confirm a deploy actually succeeded rather
than just "the container started."

```json
{
  "status": "healthy",
  "database": "healthy",
  "redis": "healthy"
}
```

## Queue visibility

`bull-board` (or equivalent BullMQ UI) mounted on the backend behind auth,
e.g. `/admin/queues`. Not user-facing — an operator tool for seeing job
counts, a stuck job's stack trace, or manually retrying a dead-lettered
job during a demo or debugging session, without querying Redis directly or
grepping worker logs. Cheap to add (a few lines against an already-running
BullMQ instance) and expensive to be without the one time a job hangs
mid-demo and there's no visibility into why.

## Docker build notes

Because of npm workspaces, Docker build **context must be the repo root**,
not the individual service folder — otherwise `@CodeTrace/shared-types`
can't resolve during `npm install`. Multi-stage builds compile
`shared/types` to plain JS and copy the compiled output (not the symlinked
source) into the final runtime image, so the workspace symlink doesn't
silently break in the production container.

## What's explicitly out of scope

No Kubernetes, no microservices split beyond the three services described
in `architecture.md`, no multi-region deployment. A single EC2 instance
(or two, once/if split) is the right level of infrastructure complexity for
this project's scale and purpose.
