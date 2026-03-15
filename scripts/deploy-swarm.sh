#!/usr/bin/env bash
set -euo pipefail

VPS="index-maker/prod/be"
REMOTE_DIR="/home/max/index"
COMPOSE_DIR="docker/testnet/vision-swarm"
L3_RPC="http://142.132.164.24/"
ADDR_RE='^0x[0-9a-fA-F]{40}$'

echo "=== Vision Swarm Deploy ==="

# 0. Validate USDC address
USDC_ADDR=$(jq -r '.contracts.L3_WUSDC' deployments/active-deployment.json)
[[ "$USDC_ADDR" =~ $ADDR_RE ]] || { echo "ERROR: Invalid L3_WUSDC address: $USDC_ADDR"; exit 1; }

# 1. Sync code to VPS
echo "[1/5] Syncing to VPS..."
rsync -az --delete \
  --exclude='.venv' --exclude='__pycache__' --exclude='tests' \
  vision-bot/ \
  "$VPS:$REMOTE_DIR/vision-bot/"

rsync -az --delete \
  "$COMPOSE_DIR/" \
  "$VPS:$REMOTE_DIR/$COMPOSE_DIR/"

rsync -az \
  deployments/active-deployment.json \
  deployments/vision-batches.json \
  "$VPS:$REMOTE_DIR/deployments/"

# 2. Verify swarm.env exists (generated locally, synced by rsync above)
echo "[2/5] Verifying swarm.env on VPS..."
if [ ! -f "$COMPOSE_DIR/swarm.env" ]; then
  echo "ERROR: $COMPOSE_DIR/swarm.env not found locally."
  echo "Generate it first: see plan Task 2 Step 2"
  exit 1
fi
ssh "$VPS" "test -f $REMOTE_DIR/$COMPOSE_DIR/swarm.env" || {
  echo "ERROR: swarm.env not found on VPS after sync"
  exit 1
}

# 3. Build on VPS
echo "[3/5] Building docker images..."
ssh "$VPS" "cd $REMOTE_DIR && docker compose -f $COMPOSE_DIR/docker-compose.yml build"

# 4. Fund bot wallets via cast
echo "[4/5] Funding bot wallets..."
AMOUNT="100000000000000000000000"  # 100k USDC, 18 decimals
FUND_FAILURES=0

while IFS= read -r addr; do
  addr=$(echo "$addr" | tr -d '", ')
  [[ -z "$addr" || "$addr" == "[" || "$addr" == "]" ]] && continue
  [[ "$addr" =~ $ADDR_RE ]] || { echo "  SKIP invalid address: $addr"; continue; }

  echo "  Funding $addr..."
  if ! ssh "$VPS" "source $REMOTE_DIR/.env && cast send \
    --rpc-url '$L3_RPC' \
    --private-key \"\$DEPLOYER_KEY\" \
    '$USDC_ADDR' \
    'mint(address,uint256)' \
    '$addr' '$AMOUNT' 2>&1"; then
    echo "  WARNING: funding $addr failed"
    FUND_FAILURES=$((FUND_FAILURES + 1))
  fi
done < "$COMPOSE_DIR/addresses.json"

if [ "$FUND_FAILURES" -gt 2 ]; then
  echo "ERROR: $FUND_FAILURES wallets failed to fund. Aborting."
  exit 1
fi

# 5. Start swarm (source env for ${KEY} substitution)
echo "[5/5] Starting swarm..."
ssh "$VPS" "cd $REMOTE_DIR/$COMPOSE_DIR && set -a && source swarm.env && set +a && docker compose up -d"

echo "=== Swarm deployed ==="
echo "  Logs: ssh $VPS 'cd $REMOTE_DIR/$COMPOSE_DIR && docker compose logs -f'"
echo "  Stop: ssh $VPS 'cd $REMOTE_DIR/$COMPOSE_DIR && docker compose down'"
