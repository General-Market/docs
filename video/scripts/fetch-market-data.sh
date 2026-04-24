#!/usr/bin/env bash
# Fetches the three binary-market series used by the InsiderCases Point 1
# phone scene and copies the matching b-roll from the frontend public dir.
# Data files land under ../public/data/markets/ and are read at render time
# by PhoneWithCard.tsx via staticFile(). B-roll copies to
# ../public/insider-trading/broll/markets/.
#
# Requires: ssh alias `index-maker/prod/be` (VPS 1 data-node) and the
# frontend checkout at ../../frontend. Re-run after the data-node collects
# a fresh day of samples.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKETS="$ROOT/public/data/markets"
BROLL="$ROOT/public/insider-trading/broll/markets"
FE_BROLL="$ROOT/../frontend/public/source-video"

mkdir -p "$MARKETS" "$BROLL"

fetch () {
  local asset_id="$1" source="$2" out="$3" market="$4" question="$5" brand="$6" unit="$7"
  local url="http://127.0.0.1:8200/market/prices/${source}/${asset_id}/history"
  local raw
  raw="$(ssh -o ConnectTimeout=8 index-maker/prod/be "curl -s -m 12 '${url}'" 2>/dev/null | grep -v 'Unauthorized\|monitored')"
  python3 - "$raw" "$out" "$market" "$question" "$brand" "$unit" <<'PY'
import json, sys
raw = sys.argv[1]
out, market, question, brand, unit = sys.argv[2:7]
d = json.loads(raw)
pts = [{"t": p["fetchedAt"], "v": float(p["value"])} for p in d["prices"]]
nz = [p for p in pts if p["v"] >= 0]
take = nz[-48:] if len(nz) >= 48 else nz
payload = {"market": market, "question": question, "source": brand, "unit": unit, "points": take}
open(out, "w").write(json.dumps(payload, indent=2))
print(f"{market}: {len(take)} points, range {min(p['v'] for p in take):.2f}..{max(p['v'] for p in take):.2f}")
PY
}

fetch steam_game_730 steam "$MARKETS/csgo_players.json" \
  csgo-players "Will CSGO have more players in 10 minutes?" "Steam · CS:GO" players

fetch twitch_stream_xqc twitch "$MARKETS/twitch_viewers.json" \
  twitch-viewers "Will Twitch have more viewers in 10 minutes?" "Twitch · xQc" viewers

fetch db_trains_berlin_hbf db_trains "$MARKETS/berlin_delay.json" \
  berlin-delay "Will Berlin trains have delay in 10 minutes?" "Deutsche Bahn · Berlin Hbf" "min avg"

cp "$FE_BROLL/hd/steam.mp4"          "$BROLL/csgo.mp4"
cp "$FE_BROLL/hd/db_trains.mp4"      "$BROLL/berlin.mp4"
cp "$FE_BROLL/twitch-broll.mp4"      "$BROLL/twitch.mp4"

echo "done."
