#!/usr/bin/env bash
set -euo pipefail

# switch-env.sh — switch between local/testnet/mainnet environments
# Usage: ./switch-env.sh local|testnet|mainnet

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_NAME="${1:-}"

if [[ -z "$ENV_NAME" ]] || [[ ! "$ENV_NAME" =~ ^(local|testnet|mainnet)$ ]]; then
  echo -e "${RED}Usage: ./switch-env.sh local|testnet|mainnet${NC}"
  exit 1
fi

ENV_DIR="$REPO_ROOT/envs/$ENV_NAME"

if [[ ! -d "$ENV_DIR" ]]; then
  echo -e "${RED}Environment directory not found: $ENV_DIR${NC}"
  exit 1
fi

echo -e "${YELLOW}Switching to: $ENV_NAME${NC}"

# 1. Copy .env → frontend/.env.local
cp "$ENV_DIR/.env" "$REPO_ROOT/frontend/.env.local"
echo "  .env → frontend/.env.local"

# 2. Patch deployment.json from latest forge broadcasts, then copy to destinations
"$REPO_ROOT/sync-deployment.sh" "$ENV_NAME" 2>/dev/null || true
cp "$ENV_DIR/deployment.json" "$REPO_ROOT/deployments/active-deployment.json"
cp "$ENV_DIR/deployment.json" "$REPO_ROOT/frontend/lib/contracts/deployment.json"
echo "  deployment.json → deployments/active-deployment.json + frontend/lib/contracts/"

# 3. Copy morpho-deployment.json → two locations
cp "$ENV_DIR/morpho-deployment.json" "$REPO_ROOT/deployments/morpho-e2e.json"
cp "$ENV_DIR/morpho-deployment.json" "$REPO_ROOT/frontend/lib/contracts/morpho-deployment.json"
echo "  morpho-deployment.json → deployments/morpho-e2e.json + frontend/lib/contracts/"

# 4. Copy vision-batches.json → two locations
cp "$ENV_DIR/vision-batches.json" "$REPO_ROOT/deployments/vision-batches.json"
cp "$ENV_DIR/vision-batches.json" "$REPO_ROOT/frontend/lib/contracts/vision-batches.json"
echo "  vision-batches.json → deployments/vision-batches.json + frontend/lib/contracts/"

# 5. Write sentinel file
echo "$ENV_NAME" > "$REPO_ROOT/.active-env"

# 6. Kill running Next.js dev server (it caches .env.local at boot — stale env = 404s)
NEXT_PID=$(lsof -ti :3000 2>/dev/null || true)
if [[ -n "$NEXT_PID" ]]; then
  kill $NEXT_PID 2>/dev/null || true
  echo -e "  ${YELLOW}Killed Next.js dev server (pid $NEXT_PID) — restart with: cd frontend && npm run dev${NC}"
fi

echo -e "${GREEN}Switched to $ENV_NAME${NC}"
