#!/bin/bash
# Verify all data sources are healthy.
# Hits the data-node health endpoint and prints a formatted, color-coded report.
#
# Usage:
#   ./scripts/verify-sources.sh                        # uses localhost:8200
#   DATA_NODE_URL=http://prod:8200 ./scripts/verify-sources.sh
#
# Exit codes:
#   0 — all sources healthy or stale
#   1 — one or more sources are dead

set -euo pipefail

DATA_NODE="${DATA_NODE_URL:-http://localhost:8200}"
ENDPOINT="$DATA_NODE/admin/sources/health"

echo "=== Source Health Report ==="
echo "Endpoint: $ENDPOINT"
echo ""

RESPONSE=$(curl -sf "$ENDPOINT" 2>&1) || {
  echo -e "\033[91mERROR: Failed to reach $ENDPOINT\033[0m"
  echo "Make sure the data-node is running and accessible."
  exit 1
}

echo "$RESPONSE" | python3 -c "
import json, sys

data = json.load(sys.stdin)
sources = data.get('sources', [])

if not sources:
    print('No sources found in response.')
    sys.exit(0)

# Sort: dead first, then stale, then healthy
def sort_key(s):
    status = s.get('status', 'unknown')
    if status == 'dead': return 0
    if status == 'stale': return 1
    return 2

sources.sort(key=sort_key)

# ANSI colors
RED = '\033[91m'
YELLOW = '\033[93m'
GREEN = '\033[92m'
CYAN = '\033[96m'
RESET = '\033[0m'
BOLD = '\033[1m'
DIM = '\033[2m'

# Header
header = (
    f'{BOLD}'
    f'{\"Source\":<25} '
    f'{\"Status\":<10} '
    f'{\"Assets\":<8} '
    f'{\"Records\":<12} '
    f'{\"Freshness\":<10} '
    f'{\"Zeros\":<7} '
    f'{\"Stale\":<7} '
    f'{\"MaxGap\":<9} '
    f'{\"AvgChg%\":<8}'
    f'{RESET}'
)
print(header)
print('-' * 96)

for s in sources:
    status = s.get('status', 'unknown')
    if status == 'dead':
        color = RED
    elif status == 'stale':
        color = YELLOW
    else:
        color = GREEN

    source_id = s.get('source_id', s.get('sourceId', '???'))
    active = s.get('active_assets', s.get('activeAssets', 0))
    total_records = s.get('total_price_records', s.get('totalPriceRecords', 0))
    freshness = s.get('last_sync_age_secs', s.get('lastSyncAgeSecs', 0))
    zeros = s.get('zero_value_assets', s.get('zeroValueAssets', 0))
    stale_ct = s.get('stale_assets', s.get('staleAssets', 0))
    max_gap = s.get('sync_gap_max_secs', s.get('syncGapMaxSecs', 0))
    avg_chg = s.get('avg_change_pct', s.get('avgChangePct', 0)) or 0

    # Format freshness as human-readable
    def fmt_secs(secs):
        if secs < 60: return f'{int(secs)}s'
        if secs < 3600: return f'{int(secs/60)}m'
        if secs < 86400: return f'{secs/3600:.1f}h'
        return f'{secs/86400:.1f}d'

    # Format record count
    def fmt_num(n):
        if n >= 1_000_000: return f'{n/1_000_000:.1f}M'
        if n >= 1_000: return f'{n/1_000:.1f}K'
        return str(n)

    row = (
        f'{color}'
        f'{source_id:<25} '
        f'{status:<10} '
        f'{active:<8} '
        f'{fmt_num(total_records):<12} '
        f'{fmt_secs(freshness):<10} '
        f'{zeros:<7} '
        f'{stale_ct:<7} '
        f'{fmt_secs(max_gap):<9} '
        f'{avg_chg:<8.2f}'
        f'{RESET}'
    )
    print(row)

# Summary
dead = [s for s in sources if s.get('status') == 'dead']
stale = [s for s in sources if s.get('status') == 'stale']
healthy = [s for s in sources if s.get('status') == 'healthy']

print()
print(
    f'Total: {len(sources)} sources | '
    f'{GREEN}Healthy: {len(healthy)}{RESET} | '
    f'{YELLOW}Stale: {len(stale)}{RESET} | '
    f'{RED}Dead: {len(dead)}{RESET}'
)

generated = data.get('generated_at', data.get('generatedAt', ''))
if generated:
    print(f'{DIM}Generated: {generated}{RESET}')

# Exit code
if dead:
    print()
    print(f'{RED}{BOLD}FAIL: {len(dead)} dead source(s) detected{RESET}')
    for s in dead:
        sid = s.get('source_id', s.get('sourceId', '???'))
        print(f'{RED}  - {sid}{RESET}')
    sys.exit(1)
else:
    print()
    print(f'{GREEN}{BOLD}OK: All sources alive{RESET}')
    sys.exit(0)
"
