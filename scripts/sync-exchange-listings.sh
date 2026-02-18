#!/usr/bin/env bash
# sync-exchange-listings.sh — Fetch Bitget spot pairs → data/exchange-listings.json
#
# Usage: ./scripts/sync-exchange-listings.sh
#
# Fetches all spot trading pairs from Bitget API and writes them to
# data/exchange-listings.json for use by issuer delisting verification.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$ROOT_DIR/data/exchange-listings.json"

echo "Fetching Bitget spot pairs..."

# Fetch all spot symbols from Bitget API
RESPONSE=$(curl -s "https://api.bitget.com/api/v2/spot/public/symbols")

if [ -z "$RESPONSE" ]; then
    echo "ERROR: Empty response from Bitget API"
    exit 1
fi

# Extract symbol names and build exchange-listings.json
python3 -c "
import json, sys
from datetime import datetime, timezone

response = json.loads('''$RESPONSE''')

if response.get('code') != '00000':
    print(f'ERROR: Bitget API returned code {response.get(\"code\")}: {response.get(\"msg\")}', file=sys.stderr)
    sys.exit(1)

symbols = sorted(set(item['symbol'] for item in response.get('data', [])))

listings = {
    'bitget': symbols,
    'updated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}

with open('$OUTPUT_FILE', 'w') as f:
    json.dump(listings, f, indent=2)
    f.write('\n')

print(f'Synced {len(symbols)} Bitget spot pairs to $OUTPUT_FILE')
"
