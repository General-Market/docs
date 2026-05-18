#!/usr/bin/env bash
# Devnet deploy for the prediction-market Anchor program.
#
# Run-once per program ID rotation. Refreshes the IDL and propagates it to
# nsgame/lib/solana/idl. Does not touch keypairs, does not send admin ixs.
# Follow with deploy/bootstrap.sh.
set -euo pipefail

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROGRAM_KEYPAIR="${PROJECT_ROOT}/target/deploy/prediction_market-keypair.json"
PROGRAM_SO="${PROJECT_ROOT}/target/deploy/prediction_market.so"
IDL_JSON="${PROJECT_ROOT}/target/idl/prediction_market.json"
IDL_TS="${PROJECT_ROOT}/target/types/prediction_market.ts"
NSGAME_IDL_DIR="/Users/maxguillabert/Downloads/index/nsgame/lib/solana/idl"

# -----------------------------------------------------------------------------
# Preflight
# -----------------------------------------------------------------------------
command -v solana >/dev/null 2>&1 || { echo "solana CLI not found"; exit 1; }
command -v anchor >/dev/null 2>&1 || { echo "anchor CLI not found"; exit 1; }

echo "==> Switching Solana CLI to devnet"
solana config set --url devnet >/dev/null

OPERATOR_ADDR="$(solana address)"
BAL_SOL_RAW="$(solana balance --lamports | awk '{print $1}')"
BAL_SOL="$(awk -v l="${BAL_SOL_RAW}" 'BEGIN{printf "%.4f", l/1000000000}')"

echo "==> Operator: ${OPERATOR_ADDR}"
echo "==> Balance : ${BAL_SOL} SOL"

# Lamports comparison — 500_000_000 = 0.5 SOL, 2_000_000_000 = 2 SOL.
if [[ "${BAL_SOL_RAW}" -lt 500000000 ]]; then
  echo "ERROR: balance below 0.5 SOL — devnet deploys cost ~1.5 SOL" >&2
  exit 1
fi
if [[ "${BAL_SOL_RAW}" -lt 2000000000 ]]; then
  echo "WARN: balance below 2 SOL — deploy may fail mid-flight" >&2
fi

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
echo "==> anchor build"
(cd "${PROJECT_ROOT}" && anchor build)

[[ -f "${PROGRAM_SO}" ]] || { echo "ERROR: ${PROGRAM_SO} missing after build"; exit 1; }
[[ -f "${PROGRAM_KEYPAIR}" ]] || { echo "ERROR: ${PROGRAM_KEYPAIR} missing"; exit 1; }

# -----------------------------------------------------------------------------
# Deploy
# -----------------------------------------------------------------------------
echo "==> solana program deploy"
solana program deploy "${PROGRAM_SO}" --program-id "${PROGRAM_KEYPAIR}"

PROGRAM_ID="$(solana address -k "${PROGRAM_KEYPAIR}")"
echo "==> Program ID: ${PROGRAM_ID}"

# -----------------------------------------------------------------------------
# IDL refresh + propagation
# -----------------------------------------------------------------------------
# anchor build regenerates target/idl/*.json with the current declare_id!. If
# declare_id! in lib.rs does not match ${PROGRAM_ID}, refuse to propagate — the
# operator must update lib.rs and rebuild before shipping a mismatched IDL.
IDL_ADDR="$(grep -o '"address":[[:space:]]*"[^"]*"' "${IDL_JSON}" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
if [[ "${IDL_ADDR}" != "${PROGRAM_ID}" ]]; then
  echo "ERROR: IDL address (${IDL_ADDR}) != deployed program id (${PROGRAM_ID})" >&2
  echo "       Update declare_id! in programs/prediction-market/src/lib.rs and rerun." >&2
  exit 1
fi

[[ -d "${NSGAME_IDL_DIR}" ]] || { echo "ERROR: ${NSGAME_IDL_DIR} does not exist"; exit 1; }
[[ -f "${IDL_JSON}" ]] || { echo "ERROR: ${IDL_JSON} missing"; exit 1; }
[[ -f "${IDL_TS}" ]]   || { echo "ERROR: ${IDL_TS} missing (run anchor build with a toolchain that emits types)"; exit 1; }

echo "==> Copying IDL to nsgame"
cp "${IDL_JSON}" "${NSGAME_IDL_DIR}/prediction_market.json"
cp "${IDL_TS}"   "${NSGAME_IDL_DIR}/prediction_market.ts"

# -----------------------------------------------------------------------------
# Banner
# -----------------------------------------------------------------------------
cat <<EOF

-------------------------------------------------------------------------------
 deploy complete — program lives
-------------------------------------------------------------------------------
 program id : ${PROGRAM_ID}
 cluster    : devnet
 idl        : ${IDL_JSON}
 mirrored   : ${NSGAME_IDL_DIR}/prediction_market.{json,ts}

 next:
   export ORACLE_PUBKEY=<oracle signer pubkey>
   export STAKE_MINT=<SPL mint used for bets>
   bash ${SCRIPT_DIR}/bootstrap.sh

 after bootstrap, wait 24h for the multisig delay, then:
   bash ${SCRIPT_DIR}/activate-oracle.sh
-------------------------------------------------------------------------------
EOF
