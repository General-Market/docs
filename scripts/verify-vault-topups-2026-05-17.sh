#!/usr/bin/env bash
# Verify the vault topup ran. Three checks:
#   1) Postgres joins in last 5 min, grouped by source.
#   2) fund-manager log lines showing "Joined batch".
#   3) Sample 10 vaults on chain — show current idleUSDC.
#
# Run AFTER topup script completes and the fund-manager is restarted.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROGRESS="${ROOT}/deployments/vault-topup-2026-05-17.json"

echo "=== 1) Postgres joins in last 5 min ==="
ssh index-maker/prod/be "PGPASSWORD=m_f310f8cc478d54483105863917900d31 psql -h 127.0.0.1 -U max -d index_prices -c \"
SELECT vbl.source_id, COUNT(*) AS joins_5m
FROM vision_positions vp
JOIN vision_batch_lifecycle vbl ON vbl.batch_id = vp.batch_id
WHERE vp.balance > 0
  AND vp.join_timestamp > EXTRACT(epoch FROM NOW() - INTERVAL '5 min')::bigint
GROUP BY vbl.source_id
ORDER BY 2 DESC;
\""

echo ""
echo "=== 2) Last 20 'Joined batch' lines from fund-manager (last 5 min) ==="
ssh index-maker/prod/be "docker logs fund-manager --since 5m 2>&1 | grep -E 'Joined batch' | tail -20"

echo ""
echo "=== 3) Sample 10 vaults — current idleUSDC ==="
# Pull 10 random topped-up vaults from progress file
if [ -f "$PROGRESS" ]; then
  jq -r '.entries | to_entries[] | select(.value.status=="topped_up") | "\(.key) \(.value.symbol)"' "$PROGRESS" \
    | shuf -n 10 2>/dev/null || jq -r '.entries | to_entries[] | select(.value.status=="topped_up") | "\(.key) \(.value.symbol)"' "$PROGRESS" | head -10 \
  | while read -r addr sym; do
      idle=$(cast call "$addr" "idleUSDC()(uint256)" --rpc-url https://rpc.generalmarket.io/ 2>/dev/null | awk '{print $1}')
      if [ -n "$idle" ]; then
        printf "  %-7s %s  idle=%s\n" "$sym" "$addr" "$(echo "scale=2; $idle/10^18" | bc -l)"
      fi
    done
fi

echo ""
echo "=== Summary from progress file ==="
jq '.totals' "$PROGRESS"
