#!/usr/bin/env bash
set -euo pipefail

# Renews the Let's Encrypt cert via the webroot method — nginx must
# already be running, serving /.well-known/acme-challenge/ from the same
# codetrace_certbot_webroot volume certbot writes into here (see the
# nginx service's volumes in docker-compose.single-vm.yml). Safe to run
# repeatedly/unattended: certbot only actually renews within ~30 days of
# expiry, everything else is a fast no-op check.
#
# Wire this into a host cron job, e.g.:
#   0 3 * * * cd /path/to/CodeTrace && ./scripts/renew-tls.sh >> /var/log/codetrace-tls-renew.log 2>&1
#
# Usage: ./scripts/renew-tls.sh [compose-file]

COMPOSE_FILE="${1:-infra/docker-compose.single-vm.yml}"

docker run --rm \
  -v codetrace_certbot_certs:/etc/letsencrypt \
  -v codetrace_certbot_webroot:/var/www/certbot \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet

docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload
echo "==> Renewal check complete, nginx reloaded."
