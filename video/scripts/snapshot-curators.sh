#!/usr/bin/env bash
# Refresh the Morpho-curators snapshot used by the MorphoCurators
# composition. Pulls the "Risk Curators" category from DefiLlama —
# the same upstream our data-node's defillama_protocols collector
# mirrors — sorted by TVL descending.
#
# Usage: ./scripts/snapshot-curators.sh
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="src/compositions/morpho-curators/curators.json"

curl -sS "https://api.llama.fi/protocols" \
  | jq '[.[]
        | select(.category == "Risk Curators")
        | {slug, name, tvl, change_1d, change_7d, chains, logo}]
       | sort_by(-.tvl)' \
  > "$OUT"

echo "Updated $OUT with $(jq 'length' "$OUT") curators."
