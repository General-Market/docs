#!/usr/bin/env bash
set -euo pipefail

# sync-deployment.sh — Extract contract addresses from forge broadcast and update deployment JSONs.
#
# Reads the latest broadcast for each deploy script on a given chain,
# extracts CREATE transactions, and patches the deployment JSON with fresh addresses.
# Then syncs to envs/<env>/ and frontend/.
#
# Usage:
#   ./sync-deployment.sh              # Auto-detect env from .active-env
#   ./sync-deployment.sh testnet      # Explicit env
#   ./sync-deployment.sh testnet 111222333   # Explicit env + chain

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

# ── Resolve environment ──
ENV_NAME="${1:-}"
if [[ -z "$ENV_NAME" ]]; then
  if [[ -f .active-env ]]; then
    ENV_NAME=$(cat .active-env)
  else
    echo -e "${RED}No active env. Usage: ./sync-deployment.sh <local|testnet|mainnet> [chainId]${NC}"
    exit 1
  fi
fi

# ── Resolve chain ID ──
CHAIN_ID="${2:-}"
if [[ -z "$CHAIN_ID" ]]; then
  case "$ENV_NAME" in
    local)   CHAIN_ID=421611337 ;;
    testnet) CHAIN_ID=111222333 ;;
    mainnet) CHAIN_ID=111222333 ;;  # same L3 for now
    *)       echo -e "${RED}Unknown env: $ENV_NAME${NC}"; exit 1 ;;
  esac
fi

DEPLOYMENT_FILE="envs/$ENV_NAME/deployment.json"

if [[ ! -f "$DEPLOYMENT_FILE" ]]; then
  echo -e "${RED}Deployment file not found: $DEPLOYMENT_FILE${NC}"
  exit 1
fi

echo -e "${CYAN}Syncing deployment from broadcast → $ENV_NAME (chain $CHAIN_ID)${NC}"

# ── Scan all broadcast dirs for this chain ──
BROADCAST_BASE="contracts/broadcast"
UPDATED=0

python3 - "$BROADCAST_BASE" "$CHAIN_ID" "$DEPLOYMENT_FILE" <<'PYEOF'
import json, sys, os, glob

broadcast_base = sys.argv[1]
chain_id = sys.argv[2]
deployment_file = sys.argv[3]

# Load current deployment
deploy = json.load(open(deployment_file))
contracts = deploy.get("contracts", {})
original = dict(contracts)

# Scan all broadcast dirs for this chain
pattern = os.path.join(broadcast_base, "*", chain_id, "run-latest.json")
broadcast_files = sorted(glob.glob(pattern))

if not broadcast_files:
    print(f"  No broadcasts found for chain {chain_id}")
    sys.exit(0)

# Build a map of contract name -> address from all broadcasts (latest wins)
found = {}
for bf in broadcast_files:
    script_name = bf.split("/")[-3]  # e.g., DeployFullSystemE2E.s.sol
    try:
        data = json.load(open(bf))
    except Exception:
        continue

    for tx in data.get("transactions", []):
        if tx.get("transactionType") != "CREATE":
            continue
        name = tx.get("contractName")
        addr = tx.get("contractAddress")
        if name and addr:
            found[name] = (addr, script_name)

if not found:
    print("  No CREATE transactions found in broadcasts")
    sys.exit(0)

# Map broadcast contract names to deployment JSON keys.
# Most are 1:1 (e.g., MockBitgetVault -> MockBitgetVault).
# Some need special mapping.
KEY_MAP = {
    "Index": "Index",
    "Governance": "Governance",
    "OracleRegistry": "OracleRegistry",
    "CollateralRegistry": "CollateralRegistry",
    "L3BridgeCustody": "L3BridgeCustody",
    "SettlementBridgeCustody": "SettlementBridgeCustody",
    "BLSCustody": "BLSCustody",
    "MockBitgetVault": "MockBitgetVault",
    "BridgeProxy": "BridgeProxy",
    "BridgedItpFactory": "BridgedItpFactory",
    "Investment": "Investment",
    "Vision": "Vision",
}

changes = []
for contract_name, (addr, script) in found.items():
    # Direct key match
    key = KEY_MAP.get(contract_name)
    if not key:
        # Try exact match against existing keys
        if contract_name in contracts:
            key = contract_name

    if key and key in contracts:
        old = contracts[key]
        if old.lower() != addr.lower():
            contracts[key] = addr
            changes.append((key, old, addr, script))

if not changes:
    print("  All addresses up to date")
    sys.exit(0)

# Write updated deployment
deploy["contracts"] = contracts
json.dump(deploy, open(deployment_file, "w"), indent=2)

for key, old, new, script in changes:
    print(f"  \033[1;33m{key}\033[0m: {old[:10]}...{old[-4:]} → {new[:10]}...{new[-4:]}  (from {script})")

print(f"\n  Updated {len(changes)} address(es) in {deployment_file}")
PYEOF

# ── Propagate to all destinations ──
echo -e "${CYAN}Propagating...${NC}"

# Copy to deployments/active-deployment.json
cp "$DEPLOYMENT_FILE" deployments/active-deployment.json
echo "  → deployments/active-deployment.json"

# Copy to frontend
cp "$DEPLOYMENT_FILE" frontend/lib/contracts/deployment.json
echo "  → frontend/lib/contracts/deployment.json"

echo -e "${GREEN}Done.${NC}"
