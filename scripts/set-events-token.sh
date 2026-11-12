#!/bin/zsh
# Creates the server-only EVENTS_WRITE_TOKEN for funnel tracking (public.events):
# adds it to Vercel (Production + Preview) and .env.local, then prints its SHA-256.
# The database stores only that hash (private.settings.events_write_token_sha256).
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(openssl rand -hex 32)
for env in production preview; do
  npx vercel@latest env rm EVENTS_WRITE_TOKEN "$env" --yes --scope tech-innovation2-buck-ai >/dev/null 2>&1 || true
  printf '%s' "$TOKEN" | npx vercel@latest env add EVENTS_WRITE_TOKEN "$env" --sensitive --scope tech-innovation2-buck-ai
done

touch .env.local
grep -v '^EVENTS_WRITE_TOKEN=' .env.local > .env.local.tmp || true
printf 'EVENTS_WRITE_TOKEN=%s\n' "$TOKEN" >> .env.local.tmp
mv .env.local.tmp .env.local

echo
echo "Done. Give Claude this hash (safe to share, it can't be turned back into the token):"
printf '%s' "$TOKEN" | shasum -a 256 | cut -d' ' -f1
