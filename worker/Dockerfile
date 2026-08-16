# CodeTrace worker — production image.
# Multi-stage: build wheels/deps in a full image, run in a slim one.
# deployment.md: single EC2 instance, 2GB RAM budget — keep the runtime
# image lean; Python + tree-sitter wheels don't need a compiler at
# runtime, only at install time if a wheel isn't available for the
# target platform.

FROM python:3.12-slim AS builder

WORKDIR /build

# Build tools only needed here, never copied into the runtime stage —
# some tree-sitter-* packages may need to compile from source depending
# on platform/architecture wheel availability.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim AS runtime

# git is a hard runtime dependency: src/github/clone.py shells out to the
# `git` CLI directly (subprocess), not a Python git library, for cloning
# and diffing. Without it every indexing job fails at the CLONING stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Non-root: this process clones third-party repository content and calls
# out to an LLM API — least-privilege matches security.md's general
# posture even though it doesn't call out container users specifically.
RUN groupadd --system worker && useradd --system --gid worker --create-home worker

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY --chown=worker:worker src ./src

USER worker

STOPSIGNAL SIGTERM

# Exec form (not shell form) is required — shell form runs the process
# as a child of /bin/sh -c "...", which does NOT forward SIGTERM to the
# child process. That would silently defeat main.py's graceful-shutdown
# signal handling: `docker stop` would still hard-kill the worker
# mid-job instead of letting it drain, exactly the failure mode that fix
# exists to prevent.
#
# CONFIRMED BY LIVE TEST: docker stop DOES deliver SIGTERM correctly to
# this process (main.py's "Shutdown signal received" log fires) — but
# the drain then exceeded Docker's default 10s stop grace period and was
# force-killed (exit 137) before "Worker shut down." logged, even with
# zero in-flight jobs. BullMQ's own docs confirm Worker.close() has no
# internal timeout. Whatever compose file eventually runs this image
# MUST set `stop_grace_period` well above 10s (indexing jobs can run
# minutes; close() waits for the current job to finish) — this
# Dockerfile alone cannot fix that, it's a docker-compose.yml setting.
CMD ["python", "-m", "src.main"]
