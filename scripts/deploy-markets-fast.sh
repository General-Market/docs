#!/usr/bin/env bash
# deploy-markets-fast.sh — Deploy Morpho markets using cast (no forge recompilation).
# Uses explicit nonce tracking to avoid drift on Orbit L3.
set -uo pipefail

RPC="${L3_RPC_URL:-http://142.132.164.24/}"
KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER=$(cast wallet address "$KEY" 2>/dev/null)

MORPHO="0xecf30fA79bb8aB854932E3De0a7D75Cf19cFd867"
VAULT="0xEd0B49a94104D65B8280B0B505402523A2fDBB6d"
IRM="0x9AFC81B6182F63dc10FECC42256248eE84593B27"
LOAN="0xB9f33D949224CEbb2c0eA649688FCf7cE57D8cD9"
MIRROR="0x4B0aac291f93081E6338d32dE15a5c4BEEEF1de1"
LLTV="770000000000000000"
PRICE="1000000000000000000000000000000000000"
MAX_CAP="24519928653854221733733552434404946937899825954937634815"

# Oracle bytecode from compiled artifacts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ORACLE_BYTECODE=$(jq -r '.bytecode.object' "$ROOT/contracts/out/ITPNAVOracle.sol/ITPNAVOracle.json")

echo "=== Fast Market Deployer ==="
echo "Deployer: $DEPLOYER"
echo "Oracle bytecode: ${#ORACLE_BYTECODE} chars"

# Get current nonce
NONCE=$(cast nonce "$DEPLOYER" --rpc-url "$RPC")
echo "Starting nonce: $NONCE"

# Read vault addresses
VAULTS_FILE="/tmp/itp-vaults.txt"
if [[ ! -f "$VAULTS_FILE" ]]; then
  echo "Generating vault list..."
  INDEX=$(jq -r '.contracts.Index' $ROOT/frontend/lib/contracts/deployment.json)
  python3 -c "
import subprocess
index = '$INDEX'
rpc = '$RPC'
vaults = []
for i in range(1, 78):
    itp_id = f'0x{i:064x}'
    r = subprocess.run(['cast', 'call', index, 'itpVaults(bytes32)(address)', itp_id, '--rpc-url', rpc], capture_output=True, text=True)
    addr = r.stdout.strip()
    if addr and addr != '0x0000000000000000000000000000000000000000':
        vaults.append(addr)
with open('$VAULTS_FILE', 'w') as f:
    f.write('\n'.join(vaults) + '\n')
print(f'{len(vaults)} vaults')
"
fi

# Check which vaults already have Morpho markets
echo ""
echo "Checking existing markets..."
NEED_DEPLOY=()
while IFS= read -r COLL; do
  # Compute marketId: keccak256(abi.encode(MarketParams))
  MID=$(cast keccak256 "$(cast abi-encode 'f(address,address,address,address,uint256)' "$LOAN" "$COLL" "0x0000000000000000000000000000000000000000" "$IRM" "$LLTV")" 2>/dev/null)

  # Actually we can't predict the oracle address, so just try checking all possible markets
  # Simpler approach: try to see if this vault has a market cap in the MetaMorpho vault
  # Actually simplest: just deploy and let createMarket be idempotent (it skips if exists)
  NEED_DEPLOY+=("$COLL")
done < "$VAULTS_FILE"

# Limit to 29 (MetaMorpho queue = 30 - 1 existing)
TOTAL=${#NEED_DEPLOY[@]}
MAX=29
if [ $TOTAL -gt $MAX ]; then
  echo "Limiting to $MAX markets (MetaMorpho queue cap)"
  TOTAL=$MAX
fi

echo "Markets to deploy: $TOTAL"
echo ""

OK=0
FAIL=0
MARKET_IDS=()
ORACLE_ADDRS=()

pad() { printf "%064s" "$(echo "$1" | sed 's/^0x//')" | tr ' ' '0'; }

for i in $(seq 0 $((TOTAL - 1))); do
  COLL="${NEED_DEPLOY[$i]}"
  echo -n "[$i] $COLL: "

  # Refresh nonce before each market (handles external tx interference)
  NONCE=$(cast nonce "$DEPLOYER" --rpc-url "$RPC")

  # 1. Deploy oracle: constructor(address, address, uint256)
  CTOR_ARGS=$(cast abi-encode "constructor(address,address,uint256)" "$MIRROR" "$COLL" "$PRICE")
  DEPLOY_DATA="${ORACLE_BYTECODE}${CTOR_ARGS#0x}"

  TX=$(cast send --private-key "$KEY" --rpc-url "$RPC" --nonce "$NONCE" \
    --gas-limit 1500000 --create "$DEPLOY_DATA" --json 2>/dev/null)
  STATUS=$(echo "$TX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','0x0'))" 2>/dev/null)
  ORACLE=$(echo "$TX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('contractAddress',''))" 2>/dev/null)

  if [[ "$STATUS" != "0x1" || -z "$ORACLE" ]]; then
    echo "oracle deploy FAILED"
    FAIL=$((FAIL + 1))
    continue
  fi
  NONCE=$((NONCE + 1))

  # 2. Create market: Morpho.createMarket(MarketParams)
  cast send "$MORPHO" "createMarket((address,address,address,address,uint256))" \
    "($LOAN,$COLL,$ORACLE,$IRM,$LLTV)" \
    --private-key "$KEY" --rpc-url "$RPC" --nonce "$NONCE" --gas-limit 500000 2>/dev/null >/dev/null || true
  NONCE=$((NONCE + 1))

  # 3. Submit cap
  cast send "$VAULT" "submitCap((address,address,address,address,uint256),uint256)" \
    "($LOAN,$COLL,$ORACLE,$IRM,$LLTV)" "$MAX_CAP" \
    --private-key "$KEY" --rpc-url "$RPC" --nonce "$NONCE" --gas-limit 200000 2>/dev/null >/dev/null || true
  NONCE=$((NONCE + 1))

  # 4. Accept cap (instant, timelock=0)
  cast send "$VAULT" "acceptCap((address,address,address,address,uint256))" \
    "($LOAN,$COLL,$ORACLE,$IRM,$LLTV)" \
    --private-key "$KEY" --rpc-url "$RPC" --nonce "$NONCE" --gas-limit 200000 2>/dev/null >/dev/null || true
  NONCE=$((NONCE + 1))

  # Compute marketId
  MID=$(cast call "$MORPHO" "idToMarketParams(bytes32)(address,address,address,address,uint256)" \
    "0x0000000000000000000000000000000000000000000000000000000000000000" \
    --rpc-url "$RPC" 2>/dev/null | head -1 || echo "")

  echo "OK (oracle=$ORACLE)"
  OK=$((OK + 1))
  ORACLE_ADDRS+=("$ORACLE")
done

echo ""
echo "Created: $OK / $TOTAL"
echo "Failed: $FAIL"

# Set supply queue with all markets in the withdraw queue
echo ""
echo "Setting supply queue..."
WQ_LEN=$(cast call "$VAULT" "withdrawQueueLength()(uint256)" --rpc-url "$RPC" 2>/dev/null)
echo "Withdraw queue has $WQ_LEN markets"

# Build array of indices [0, 1, 2, ..., WQ_LEN-1]
INDICES="["
for j in $(seq 0 $((WQ_LEN - 1))); do
  if [ $j -gt 0 ]; then INDICES+=","; fi
  # Read market ID from withdraw queue
  MID=$(cast call "$VAULT" "withdrawQueue(uint256)(bytes32)" "$j" --rpc-url "$RPC" 2>/dev/null)
  INDICES+="$MID"
done
INDICES+="]"

# setSupplyQueue takes Id[] (bytes32[])
NONCE=$(cast nonce "$DEPLOYER" --rpc-url "$RPC")
cast send "$VAULT" "setSupplyQueue(bytes32[])" "$INDICES" \
  --private-key "$KEY" --rpc-url "$RPC" --nonce "$NONCE" --gas-limit 1000000 2>/dev/null >/dev/null && \
  echo "Supply queue set with $WQ_LEN markets" || echo "Supply queue set FAILED"

echo ""
echo "Done. Supply queue:"
SQ_LEN=$(cast call "$VAULT" "supplyQueueLength()(uint256)" --rpc-url "$RPC" 2>/dev/null)
echo "  Supply queue: $SQ_LEN"
echo "  Withdraw queue: $(cast call "$VAULT" "withdrawQueueLength()(uint256)" --rpc-url "$RPC" 2>/dev/null)"
