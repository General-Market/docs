#!/usr/bin/env bash
# Admin bootstrap — runs once after deploy/devnet.sh.
#
# Calls initialize_config, three upsert_source, and propose_oracle_signers.
# Signer is the default Solana CLI keypair (~/.config/solana/id.json). The
# multisig activation timer starts the moment this script finishes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${ORACLE_PUBKEY:?ORACLE_PUBKEY must be set (base58 oracle signer pubkey)}"
: "${STAKE_MINT:?STAKE_MINT must be set (base58 SPL mint for bets)}"

# ts-node runs in-place against bootstrap.ts. We prefer npx so the operator
# does not need a global install.
if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx not found. install Node.js ≥ 18." >&2
  exit 1
fi

cd "${SCRIPT_DIR}"

# Install deps on first run. Subsequent runs reuse node_modules. Versions are
# pinned in deploy/package.json — the client must match the program's
# anchor-lang crate exactly.
if [[ ! -d node_modules/@anchor-lang/core ]] || [[ ! -d node_modules/@solana/web3.js ]]; then
  echo "==> installing bootstrap dependencies (from deploy/package.json)"
  npm install
fi

echo "==> running bootstrap"
npx ts-node \
  --compiler-options '{"module":"commonjs","target":"es2020","esModuleInterop":true,"resolveJsonModule":true}' \
  "${SCRIPT_DIR}/bootstrap.ts"
