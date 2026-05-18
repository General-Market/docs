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

# Validate deployment.json before copying — prevent Anvil addresses from reaching testnet/mainnet.
# Prefer active-deployment.json when it exists: it carries sourceVaults/whitelistedVaults
# (the merged 73-source map) that deployment.json lacks. The fast-joiner and frontend
# both depend on those arrays — copying the smaller deployment.json strips them.
if [[ -f "$ENV_DIR/active-deployment.json" ]]; then
  DEPLOY_FILE="$ENV_DIR/active-deployment.json"
else
  DEPLOY_FILE="$ENV_DIR/deployment.json"
fi
if [[ -f "$DEPLOY_FILE" ]]; then
  DEPLOY_CHAIN_ID=$(python3 -c "import json; print(json.load(open('$DEPLOY_FILE')).get('chainId', 'MISSING'))" 2>/dev/null || echo "PARSE_ERROR")
  DEPLOY_SETTLEMENT_ID=$(python3 -c "import json; print(json.load(open('$DEPLOY_FILE')).get('settlementChainId', 'MISSING'))" 2>/dev/null || echo "PARSE_ERROR")

  # Expected chain IDs per environment
  case "$ENV_NAME" in
    local)
      # Local Anvil — any chain ID is fine
      ;;
    testnet)
      if [[ "$DEPLOY_CHAIN_ID" != "111222333" ]]; then
        echo -e "${RED}FATAL: deployment.json chainId=$DEPLOY_CHAIN_ID but testnet expects 111222333${NC}"
        echo -e "${RED}This file contains wrong contract addresses. Refusing to copy.${NC}"
        exit 1
      fi
      if [[ "$DEPLOY_SETTLEMENT_ID" != "14601" ]]; then
        echo -e "${RED}FATAL: deployment.json settlementChainId=$DEPLOY_SETTLEMENT_ID but testnet expects 14601 (Sonic)${NC}"
        echo -e "${RED}This file contains wrong contract addresses. Refusing to copy.${NC}"
        exit 1
      fi
      # Verify a real Settlement-side contract exists on-chain. Use
      # SettlementBridgeProxy — that's the Sonic deployment. The plain
      # BridgeProxy key holds the L3 address which obviously has no code
      # on Sonic; testing it here was the bug that fatal'd valid deploys.
      SETTLEMENT_BRIDGE_PROXY=$(python3 -c "import json; print(json.load(open('$DEPLOY_FILE'))['contracts'].get('SettlementBridgeProxy',''))" 2>/dev/null || echo "")
      if [[ -n "$SETTLEMENT_BRIDGE_PROXY" ]]; then
        CODE_SIZE=$(cast codesize "$SETTLEMENT_BRIDGE_PROXY" --rpc-url https://rpc.testnet.soniclabs.com 2>/dev/null || echo "0")
        if [[ "$CODE_SIZE" == "0" ]]; then
          echo -e "${RED}FATAL: SettlementBridgeProxy $SETTLEMENT_BRIDGE_PROXY has NO CODE on Sonic testnet${NC}"
          echo -e "${RED}These are likely Anvil-only addresses. Refusing to copy.${NC}"
          exit 1
        fi
      fi
      ;;
    mainnet)
      # Mainnet chain IDs TBD — add validation when mainnet launches
      ;;
  esac
fi

cp "$DEPLOY_FILE" "$REPO_ROOT/deployments/active-deployment.json"
cp "$DEPLOY_FILE" "$REPO_ROOT/frontend/lib/contracts/deployment.json"
echo "  $(basename "$DEPLOY_FILE") → deployments/active-deployment.json + frontend/lib/contracts/"

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
