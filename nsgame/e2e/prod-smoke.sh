#!/usr/bin/env bash
# Production smoke tests against a live Vercel deployment.
#
# Usage:
#   ./e2e/prod-smoke.sh                                    # www.generalmarket.io
#   ./e2e/prod-smoke.sh https://frontend-xxx-mdrv.vercel.app  # preview deploy
set -euo pipefail

URL="${1:-https://www.generalmarket.io}"
echo "Running production smoke tests against: $URL"

cd "$(dirname "$0")/.."

E2E_FRONTEND_URL="$URL" \
E2E_TESTNET=1 \
  npx playwright test \
    --config e2e/playwright.prod-smoke.config.ts \
    --reporter=list \
    "$@"
