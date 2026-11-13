#!/usr/bin/env bash
# Prints the env lines for MOCK mode, using the local-only keys from `supabase start`.
# These keys only work against your own machine's Docker containers. Redirect into .env.local:
#   ./scripts/print-local-env.sh > .env.local
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null)"
cat <<ENV
NEXT_PUBLIC_APP_MODE=mock
NEXT_PUBLIC_SITE_URL=http://localhost:3470
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${PUBLISHABLE_KEY:-$ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SECRET_KEY:-$SERVICE_ROLE_KEY}
APP_TOKEN_SECRET=$(openssl rand -base64 48)
CRON_SECRET=$(openssl rand -base64 32)
DEMO_OWNER_EMAIL=owner@carlos.test
DEMO_OWNER_PASSWORD=demo-pass-123
ENV
