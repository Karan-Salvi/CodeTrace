#!/usr/bin/env bash
set -euo pipefail

# One-time TLS bootstrap: obtains the first Let's Encrypt certificate via
# certbot's standalone plugin, which needs port 80 free — run this BEFORE
# ever starting the nginx service, since nginx's config requires the cert
# files to already exist at container start (a missing
# ssl_certificate/ssl_certificate_key path is a fatal nginx startup
# error, not a graceful runtime fallback). Renewals use
# scripts/renew-tls.sh instead (webroot method, works with nginx already
# running and holding port 80/443).
#
# Usage: DOMAIN=codetrace.example.com EMAIL=you@example.com ./scripts/init-tls.sh

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=codetrace.example.com}"
: "${EMAIL:?Set EMAIL for Let's Encrypt renewal notices}"

docker volume create codetrace_certbot_certs >/dev/null
docker volume create codetrace_certbot_webroot >/dev/null

docker run --rm -p 80:80 \
  -v codetrace_certbot_certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

echo "==> Certificate obtained for $DOMAIN."
echo "==> Next: DOMAIN=$DOMAIN ./scripts/render-nginx-config.sh"
echo "==> Then: docker compose -f infra/docker-compose.single-vm.yml up -d"
