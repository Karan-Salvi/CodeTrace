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

merge to main
    v
Docker build
    v
Deploy (deploy-backend.yml / deploy-worker.yml — same target for now)
    v
Health check
```

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
