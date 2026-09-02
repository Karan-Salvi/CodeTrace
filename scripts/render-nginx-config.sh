#!/usr/bin/env bash
set -euo pipefail

# Renders infra/nginx/nginx.prod.conf's ${DOMAIN} placeholder into the
# file nginx actually mounts (infra/nginx/nginx.prod.rendered.conf, which
# is gitignored — it's generated, not source). Re-run whenever DOMAIN
# changes; safe to re-run anytime otherwise (idempotent text substitution,
# no side effects beyond overwriting the rendered file).
#
# Usage: DOMAIN=codetrace.example.com ./scripts/render-nginx-config.sh

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=codetrace.example.com}"

if ! command -v envsubst >/dev/null 2>&1; then
  echo "envsubst not found — install gettext-base (apt-get install -y gettext-base)" >&2
  exit 1
fi

# Explicit '${DOMAIN}' argument restricts substitution to ONLY that
# variable — a bare `envsubst` with no argument would also blank out
# nginx's own $host/$request_uri/etc, which look identical to shell
# variables but must be left alone for nginx to interpret at runtime.
envsubst '${DOMAIN}' < infra/nginx/nginx.prod.conf > infra/nginx/nginx.prod.rendered.conf
echo "==> Wrote infra/nginx/nginx.prod.rendered.conf for DOMAIN=$DOMAIN"
