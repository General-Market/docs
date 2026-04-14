#!/usr/bin/env bash
# Validate that every 0x-address in one or more deployment JSON files has
# live bytecode on-chain. Prints a table; exits non-zero on any dead
# address.
#
# Usage:
#   scripts/validate-deployment-addresses.sh <rpc_url> <deployment.json> [deployment2.json ...]
#
# Exit codes:
#   0 — every address has non-empty code
#   1 — at least one address returned 0x (no code)
#   2 — invocation/parsing error
#
# Requires: jq, cast.
#
# This is the generic argv-based validator used by CI. The env-aware
# pre-deploy validator lives in scripts/validate-deployment.sh.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <rpc_url> <deployment.json> [deployment2.json ...]" >&2
  exit 2
fi

RPC_URL="$1"
shift

command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 2; }
command -v cast >/dev/null 2>&1 || { echo "error: cast (foundry) required" >&2; exit 2; }

if [[ -t 1 ]]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  RED=""; GREEN=""; DIM=""; RESET=""
fi

fail=0
total=0
alive=0
dead=0

printf "%-48s %-32s %-6s\n" "Address" "Label" "State"
printf "%-48s %-32s %-6s\n" \
  "------------------------------------------------" \
  "--------------------------------" "------"

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    echo "${RED}error:${RESET} not a file: $file" >&2
    fail=1
    continue
  fi

  # Pull every (label, address) pair where the value looks like a
  # 20-byte 0x-prefixed hex string.
  mapfile -t pairs < <(
    jq -r '
      [ paths(scalars) as $p
        | { label: ($p | map(tostring) | join(".")),
            value: (getpath($p)) }
      ]
      | .[]
      | select(.value | type == "string")
      | select(.value | test("^0x[0-9a-fA-F]{40}$"))
      | "\(.value)\t\(.label)"
    ' "$file"
  )

  for line in "${pairs[@]}"; do
    addr="${line%%$'\t'*}"
    label="${line#*$'\t'}"
    total=$((total + 1))

    if code=$(cast code "$addr" --rpc-url "$RPC_URL" 2>/dev/null); then
      if [[ "$code" == "0x" || -z "$code" ]]; then
        printf "%-48s %-32s ${RED}%-6s${RESET}\n" "$addr" "$label" "DEAD"
        dead=$((dead + 1))
        fail=1
      else
        printf "%-48s %-32s ${GREEN}%-6s${RESET}\n" "$addr" "$label" "LIVE"
        alive=$((alive + 1))
      fi
    else
      printf "%-48s %-32s ${RED}%-6s${RESET} ${DIM}(rpc err)${RESET}\n" \
        "$addr" "$label" "DEAD"
      dead=$((dead + 1))
      fail=1
    fi
  done
done

echo
echo "checked $total addresses across $# file(s): $alive live, $dead dead"

exit "$fail"
