#!/usr/bin/env bash
# activate_oracle_signers — permissionless. Any funded keypair cranks it.
# Run once the 24h multisig delay has elapsed since bootstrap.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${SCRIPT_DIR}"

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx not found." >&2
  exit 1
fi

# Reuse node_modules from bootstrap. If they're missing, install from
# deploy/package.json (versions pinned in lockstep with the program).
if [[ ! -d node_modules/@anchor-lang/core ]]; then
  echo "==> installing activation dependencies (from deploy/package.json)"
  npm install
fi

RPC_URL="${SOLANA_URL:-https://api.devnet.solana.com}"
IDL_PATH="$(cd "${PROJECT_ROOT}" && pwd)/target/idl/prediction_market.json"
export IDL_PATH

npx ts-node \
  --compiler-options '{"module":"commonjs","target":"es2020","esModuleInterop":true,"resolveJsonModule":true}' \
  -e '
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AnchorProvider, Program, Wallet, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const idlPath = process.env.IDL_PATH ?? path.resolve("../target/idl/prediction_market.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as Idl & { address: string };
const programId = new PublicKey(idl.address);
const kpPath = process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config", "solana", "id.json");
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf8")) as number[]));
const connection = new Connection(process.env.SOLANA_URL ?? "https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" });
const program = new Program(idl as Idl, provider);
const [oracleConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("oracle_config")], programId);
(async () => {
  const sig = await (program.methods as any)
    .activateOracleSigners()
    .accountsPartial({ oracleConfig: oracleConfigPda })
    .rpc();
  console.log("activated — tx " + sig);
  console.log("oracle multisig live — start the daemon");
})().catch((e) => { console.error(e); process.exit(1); });
'
