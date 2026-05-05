#!/usr/bin/env bash
#
# verify-deployment.sh — refuse a deployment JSON that disagrees with the
# chain it claims. Wrapper around `data-node verify-deployment`.
#
# The April 23 incident: oracle pointed at an empty address, every
# createBatch succeeded with no BatchCreated event because the EVM
# accepts calls to codeless addresses as no-ops. Eighteen hours of
# silent failure. This script is the CI guard so committed JSON cannot
# disagree with chain reality without somebody noticing.
#
# Usage:
#   scripts/verify-deployment.sh --rpc <URL> --deployment <FILE> [--labels A,B,C]
#
# Exits 0 on success. Non-zero on chain-id mismatch, codeless address,
# missing label, or RPC failure.

set -euo pipefail

RPC=""
DEPLOYMENT=""
LABELS="Index,OracleRegistry"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc)
      RPC="$2"; shift 2;;
    --deployment)
      DEPLOYMENT="$2"; shift 2;;
    --labels)
      LABELS="$2"; shift 2;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    *)
      echo "verify-deployment: unknown argument: $1" >&2
      exit 64;;
  esac
done

if [[ -z "$RPC" || -z "$DEPLOYMENT" ]]; then
  echo "verify-deployment: --rpc and --deployment are required" >&2
  echo "Usage: $0 --rpc <URL> --deployment <FILE> [--labels A,B,C]" >&2
  exit 64
fi

if [[ ! -f "$DEPLOYMENT" ]]; then
  echo "verify-deployment: deployment file not found: $DEPLOYMENT" >&2
  exit 66
fi

# Locate the data-node binary. Prefer a release build, fall back to debug,
# then build on demand. CI typically passes DATA_NODE_BIN explicitly.
BIN="${DATA_NODE_BIN:-}"
if [[ -z "$BIN" ]]; then
  if [[ -x "target/release/data-node" ]]; then
    BIN="target/release/data-node"
  elif [[ -x "target/debug/data-node" ]]; then
    BIN="target/debug/data-node"
  else
    echo "verify-deployment: building data-node (release)…" >&2
    cargo build --release --quiet -p data-node --bin data-node
    BIN="target/release/data-node"
  fi
fi

exec "$BIN" verify-deployment \
  --deployment-file "$DEPLOYMENT" \
  --rpc-url "$RPC" \
  --labels "$LABELS"
