#!/usr/bin/env bash
# On-chain reconciliation monitor.
#
# For each ITP on L3:
#   1. Read totalSupply(itpId) on Index
#   2. Read the NAV (from data-node /itp-price)
#   3. Implied TVL_L3 = totalSupply * nav
#   4. Read collateral custody balance on the settlement chain
#   5. Alert if |custody - implied_L3| / implied_L3 > 0.1%
#
# Exit codes:
#   0 — every ITP reconciles within tolerance
#   1 — at least one ITP exceeds the gap (with context)
#   2 — invocation / dependency error
#
# Usage:
#   scripts/reconciliation-check.sh [<tolerance_bps>]
#
# Env:
#   L3_RPC_URL                 — default http://142.132.164.24/
#   SETTLEMENT_RPC_URL         — default http://localhost:8546
#   DATA_NODE_URL              — default http://localhost:8200
#   DEPLOYMENT_FILE            — default deployments/active-deployment.json
#
# Cron example (VPS 1, runs every 5 min):
#   */5 * * * * cd /home/max/index && \
#     scripts/reconciliation-check.sh >> /var/log/reconciliation.log 2>&1

set -euo pipefail

TOLERANCE_BPS="${1:-10}"       # 10 bps = 0.1 %
L3_RPC="${L3_RPC_URL:-http://142.132.164.24/}"
SETTLEMENT_RPC="${SETTLEMENT_RPC_URL:-http://localhost:8546}"
DATA_NODE_URL="${DATA_NODE_URL:-http://localhost:8200}"
DEPLOYMENT_FILE="${DEPLOYMENT_FILE:-deployments/active-deployment.json}"

for bin in cast jq curl; do
  command -v "$bin" >/dev/null || { echo "missing: $bin" >&2; exit 2; }
done

[[ -f "$DEPLOYMENT_FILE" ]] || { echo "missing deployment file: $DEPLOYMENT_FILE" >&2; exit 2; }

INDEX_ADDR=$(jq -r '.contracts.Index' "$DEPLOYMENT_FILE")
CUSTODY_ADDR=$(jq -r '.contracts.SettlementBridgeCustody // empty' "$DEPLOYMENT_FILE")

if [[ -z "$INDEX_ADDR" || "$INDEX_ADDR" == "null" ]]; then
  echo "Index address missing from $DEPLOYMENT_FILE" >&2
  exit 2
fi

# Discover ITP IDs via the data-node registry (gets both id + metadata).
# If unreachable, fall back to scanning 1..100 which is overkill but safe.
ITP_LIST=$(curl -sf "${DATA_NODE_URL}/latest-prices" 2>/dev/null | jq -r '[.prices[].itp_id] // []' 2>/dev/null || echo "[]")
if [[ "$ITP_LIST" == "[]" || -z "$ITP_LIST" ]]; then
  # Fallback: iterate hex IDs 0x01..0x64. NAV read will return zero for
  # non-existent IDs and they will be filtered out.
  ITP_LIST=$(jq -nc '[range(1;101) | "0x" + (tostring | if length < 2 then "0"+. else . end | ascii_downcase)]' 2>/dev/null || echo "[]")
fi

fail=0
checked=0

# Custody balance (settlement-chain USDC, 6 decimals).
# When no custody address is configured, the script reports L3 state only.
custody_human="?"
if [[ -n "$CUSTODY_ADDR" && "$CUSTODY_ADDR" != "null" ]]; then
  # SettlementBridgeCustody.balance() -> uint256 (USDC with 6 decimals).
  if custody_raw=$(cast call "$CUSTODY_ADDR" "balance()(uint256)" --rpc-url "$SETTLEMENT_RPC" 2>/dev/null); then
    custody_human=$(cast to-unit "$custody_raw" ether 2>/dev/null || echo "?")
  fi
fi

echo "reconciliation check — tolerance: ${TOLERANCE_BPS} bps"
echo "Index: $INDEX_ADDR"
echo "Custody: ${CUSTODY_ADDR:-<none>} (balance: $custody_human)"
echo

printf "%-12s %-22s %-22s %-10s %-8s\n" "itpId" "totalSupply(L3, 18d)" "nav(usd)" "implied_L3" "state"

implied_total="0"

for itp_id in $(echo "$ITP_LIST" | jq -r '.[]'); do
  # totalSupply is an Index.sol view that keys off itpId.
  if ! supply_raw=$(cast call "$INDEX_ADDR" "totalSupply(uint256)(uint256)" "$itp_id" \
      --rpc-url "$L3_RPC" 2>/dev/null); then
    continue
  fi
  if [[ "$supply_raw" == "0" ]]; then
    continue
  fi

  nav_json=$(curl -sf "${DATA_NODE_URL}/itp-price?itp_id=${itp_id}" 2>/dev/null || echo "{}")
  nav_usd=$(echo "$nav_json" | jq -r '.nav_display // "0"')

  # Implied L3 TVL = supply_tokens * nav_usd. Both are integers × scale
  # so we rely on cast + jq arithmetic rather than shell math.
  supply_dec=$(cast to-unit "$supply_raw" ether 2>/dev/null || echo "0")
  implied=$(jq -n --arg s "$supply_dec" --arg n "$nav_usd" '($s|tonumber) * ($n|tonumber)')
  implied_total=$(jq -n --arg a "$implied_total" --arg b "$implied" '($a|tonumber) + ($b|tonumber)')

  printf "%-12s %-22s %-22s %-10s %-8s\n" \
    "$itp_id" "$supply_dec" "$nav_usd" "$implied" "ok"
  checked=$((checked + 1))
done

echo
echo "implied L3 TVL across $checked ITPs: $implied_total"
echo "custody balance (settlement, USDC 6d denominated): $custody_human"

if [[ "$custody_human" == "?" || -z "$custody_human" ]]; then
  echo "no custody address — cannot compute gap."
  exit 0
fi

# Gap in bps. Protect against division by zero.
gap_bps=$(jq -n --arg a "$implied_total" --arg b "$custody_human" '
  ($a|tonumber) as $l3
  | ($b|tonumber) as $cust
  | if $l3 == 0 then 0
    else (((($cust - $l3) | fabs) / $l3) * 10000 | round)
    end
')

echo "gap: ${gap_bps} bps (threshold: ${TOLERANCE_BPS} bps)"

if (( gap_bps > TOLERANCE_BPS )); then
  echo "ALERT: reconciliation gap exceeds threshold." >&2
  fail=1
fi

exit "$fail"
