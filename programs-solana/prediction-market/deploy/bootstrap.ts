/**
 * Admin bootstrap — runs once, after devnet.sh lands the program.
 *
 * Sequence:
 *   1. initialize_config(fee_bps)          — provisions GlobalConfig + fee_vault PDA
 *   2. upsert_source(1, "BTC/USD", true)
 *   3. upsert_source(2, "ETH/USD", true)
 *   4. upsert_source(3, "SOL/USD", true)
 *   5. propose_oracle_signers([ORACLE_PUBKEY], 1)
 *
 * Then wait 24h. Then run deploy/activate-oracle.sh.
 *
 * Env vars:
 *   ORACLE_PUBKEY  — base58, required
 *   STAKE_MINT     — base58 SPL mint used for bets, required
 *   FEE_BPS        — integer, optional, default 50
 *   SOLANA_URL     — optional override, default https://api.devnet.solana.com
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  AnchorProvider,
  Program,
  Wallet,
  type Idl,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// -----------------------------------------------------------------------------
// Paths + env
// -----------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(PROJECT_ROOT, "target", "idl", "prediction_market.json");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const ORACLE_PUBKEY = new PublicKey(requireEnv("ORACLE_PUBKEY"));
const STAKE_MINT = new PublicKey(requireEnv("STAKE_MINT"));
const FEE_BPS = Number(process.env.FEE_BPS ?? "50");
const RPC_URL = process.env.SOLANA_URL ?? "https://api.devnet.solana.com";

if (!Number.isInteger(FEE_BPS) || FEE_BPS < 0 || FEE_BPS > 10_000) {
  console.error(`FEE_BPS out of range: ${FEE_BPS}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Wallet from default Solana CLI keypair
// -----------------------------------------------------------------------------
function loadDefaultKeypair(): Keypair {
  const kpPath = process.env.ANCHOR_WALLET
    ?? path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(kpPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// -----------------------------------------------------------------------------
// Name padding — program expects [u8; 32] zero-padded UTF-8
// -----------------------------------------------------------------------------
function pad32(name: string): number[] {
  const buf = Buffer.alloc(32);
  buf.write(name, 0, "utf8");
  return Array.from(buf);
}

async function main(): Promise<void> {
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8")) as Idl & {
    address: string;
  };
  const programId = new PublicKey(idl.address);

  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = loadDefaultKeypair();
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new Program(idl as Idl, provider);

  console.log(`program id  : ${programId.toBase58()}`);
  console.log(`admin       : ${wallet.publicKey.toBase58()}`);
  console.log(`stake mint  : ${STAKE_MINT.toBase58()}`);
  console.log(`fee bps     : ${FEE_BPS}`);
  console.log(`oracle key  : ${ORACLE_PUBKEY.toBase58()}`);
  console.log(`rpc         : ${RPC_URL}`);
  console.log("");

  // ---- PDAs -----------------------------------------------------------------
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId,
  );
  const [feeVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault")],
    programId,
  );
  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")],
    programId,
  );

  const sourcePda = (id: number): PublicKey => {
    const idBuf = Buffer.alloc(4);
    idBuf.writeUInt32LE(id, 0);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("source"), idBuf],
      programId,
    )[0];
  };

  // ---- 1. initialize_config -------------------------------------------------
  console.log("==> initialize_config");
  const existingConfig = await connection.getAccountInfo(configPda);
  if (existingConfig) {
    console.log("   config PDA already exists — skipping (idempotent)");
  } else {
    const sig = await (program.methods as any)
      .initializeConfig(FEE_BPS)
      .accounts({
        config: configPda,
        feeVault: feeVaultPda,
        stakeMint: STAKE_MINT,
        admin: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log(`   tx ${sig}`);
  }

  // ---- 2-4. upsert_source ---------------------------------------------------
  const sources: Array<{ id: number; name: string }> = [
    { id: 1, name: "BTC/USD" },
    { id: 2, name: "ETH/USD" },
    { id: 3, name: "SOL/USD" },
  ];

  for (const s of sources) {
    console.log(`==> upsert_source id=${s.id} name=${s.name}`);
    const sig = await (program.methods as any)
      .upsertSource(s.id, pad32(s.name), true)
      .accounts({
        config: configPda,
        source: sourcePda(s.id),
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   tx ${sig}`);
  }

  // ---- 5. propose_oracle_signers --------------------------------------------
  console.log("==> propose_oracle_signers");
  const sig = await (program.methods as any)
    .proposeOracleSigners([ORACLE_PUBKEY], 1)
    .accounts({
      config: configPda,
      oracleConfig: oracleConfigPda,
      admin: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`   tx ${sig}`);

  console.log("");
  console.log("-------------------------------------------------------------------------------");
  console.log(" bootstrap complete");
  console.log("-------------------------------------------------------------------------------");
  console.log(" config PDA         : " + configPda.toBase58());
  console.log(" fee vault PDA      : " + feeVaultPda.toBase58());
  console.log(" oracle config PDA  : " + oracleConfigPda.toBase58());
  console.log("");
  console.log(" the multisig is pending. the 24h clock starts now.");
  console.log(" when it elapses:");
  console.log("   bash deploy/activate-oracle.sh");
  console.log("-------------------------------------------------------------------------------");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
