#!/usr/bin/env bash
# Daily winners-reel pipeline: fetch live TVL → pick biggest mover → search the
# last-hour tweet → render the reel → write a ready-to-post bundle + notify.
# Run by launchd once a day, or by hand:  bash run.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."   # the video/ project root

# launchd hands us a minimal PATH — make node, npx and python3 reachable.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "=== winners-daily  $(date -u +%Y-%m-%dT%H:%MZ) ==="
node scripts/winners-daily/fetch-flows.mjs
node scripts/winners-daily/build-bundle.mjs
echo "=== done  $(date -u +%H:%MZ) ==="
