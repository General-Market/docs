/**
 * place-test-bet.ts — fire one end-to-end cycle.
 *
 * Calls place_bet on source_id=3 (tubes_ph aggregate) with a 60s/120s
 * window aligned to the 60s grid the program enforces. Prints every
 * signature and PDA. The oracle then closes + resolves; this script
 * does NOT call claim itself — that's permissionless and the next
 * thing to verify.
 *
 * Env:
 *   SOLANA_URL    optional, defaults to Helius devnet
 *   ANCHOR_WALLET optional, defaults to ~/.config/solana/id.json
 *   SOURCE_ID     optional, defaults to 3 (tubes_ph)
 *   BET_AMOUNT    optional, defaults to 1_000_000 (1 stake unit @ 6 dec)
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  type Idl,
} from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(PROJECT_ROOT, "target", "idl", "prediction_market.json");

const RPC_URL = process.env.SOLANA_URL ?? "https://api.devnet.solana.com";
const SOURCE_ID = Number(process.env.SOURCE_ID ?? "3");
const BET_AMOUNT = BigInt(process.env.BET_AMOUNT ?? "1000000");

function loadKeypair(): Keypair {
  const kpPath = process.env.ANCHOR_WALLET
    ?? path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(kpPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function alignToGrid(ts: number): number {
  // Snap up to the next 60-second boundary.
  return Math.ceil(ts / 60) * 60;
}

async function main(): Promise<void> {
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8")) as Idl & {
    address: string;
  };
  const programId = new PublicKey(idl.address);

  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = loadKeypair();
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl as Idl, provider);

  // ---- PDAs ---------------------------------------------------------------
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId,
  );
  const sourceIdBuf = Buffer.alloc(4);
  sourceIdBuf.writeUInt32LE(SOURCE_ID, 0);
  const [sourcePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("source"), sourceIdBuf],
    programId,
  );

  // ---- Read config to find stake mint ------------------------------------
  // GlobalConfig layout has stake_mint somewhere; easier: read GlobalConfig
  // through Anchor's account decoder.
  const globalConfig = await (program.account as any).globalConfig.fetch(configPda);
  const stakeMint = new PublicKey(globalConfig.stakeMint);
  console.log(`stake mint  : ${stakeMint.toBase58()}`);

  // ---- Window: close = next minute boundary ≥ now+30s, settlement = +60s -
  const nowSecs = Math.floor(Date.now() / 1000);
  const closeTime = alignToGrid(nowSecs + 30);
  const settlementTime = closeTime + 60;
  console.log(`now          : ${nowSecs}  (${new Date(nowSecs * 1000).toISOString()})`);
  console.log(`close_time   : ${closeTime}  (+${closeTime - nowSecs}s, ${new Date(closeTime * 1000).toISOString()})`);
  console.log(`settle_time  : ${settlementTime}  (+${settlementTime - nowSecs}s, ${new Date(settlementTime * 1000).toISOString()})`);

  const thresholdBps = 1; // smallest non-zero positive — site total grew by ≥ 0.01%

  // ---- Market PDA --------------------------------------------------------
  const closeBuf = Buffer.alloc(8);
  closeBuf.writeBigInt64LE(BigInt(closeTime), 0);
  const settleBuf = Buffer.alloc(8);
  settleBuf.writeBigInt64LE(BigInt(settlementTime), 0);
  const thresholdBuf = Buffer.alloc(4);
  thresholdBuf.writeInt32LE(thresholdBps, 0);

  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      sourceIdBuf,
      closeBuf,
      settleBuf,
      thresholdBuf,
    ],
    programId,
  );
  console.log(`market pda   : ${marketPda.toBase58()}`);

  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
    programId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPda.toBuffer()],
    programId,
  );
  const userAta = getAssociatedTokenAddressSync(stakeMint, wallet.publicKey);
  console.log(`position pda : ${positionPda.toBase58()}`);
  console.log(`vault pda    : ${vaultPda.toBase58()}`);
  console.log(`user ata     : ${userAta.toBase58()}`);
  console.log("");

  // ---- place_bet ---------------------------------------------------------
  const args = {
    sourceId: SOURCE_ID,
    closeTime: new BN(closeTime),
    settlementTime: new BN(settlementTime),
    thresholdBps,
    side: { yes: {} },
    amount: new BN(BET_AMOUNT.toString()),
  };

  console.log(`==> place_bet source_id=${SOURCE_ID} side=Yes amount=${BET_AMOUNT}`);
  const sig = await (program.methods as any)
    .placeBet(args)
    .accountsPartial({
      config: configPda,
      source: sourcePda,
      market: marketPda,
      position: positionPda,
      vault: vaultPda,
      stakeMint,
      userAta,
      user: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`   tx ${sig}`);

  console.log("");
  console.log("-------------------------------------------------------------------------------");
  console.log(" bet placed. now wait ~30s for close, then ~60s more for settlement.");
  console.log("-------------------------------------------------------------------------------");
  console.log(` market         : ${marketPda.toBase58()}`);
  console.log(` close_time     : ${closeTime}`);
  console.log(` settlement_time: ${settlementTime}`);
  console.log(` total wait     : ~${settlementTime - nowSecs}s`);
  console.log("-------------------------------------------------------------------------------");
  console.log("");
  console.log(" verify on-chain after the window closes:");
  console.log(`   solana account -u "${RPC_URL}" ${marketPda.toBase58()}`);
  console.log("");
  console.log(" oracle daemon logs:");
  console.log("   ssh vps3 'journalctl -u prediction-oracle -f --since \"5 minutes ago\" | grep -i close\\|resolve\\|claim'");
  console.log("");
  console.log(" indexer rows:");
  console.log("   ssh vps3 'sudo -u postgres psql -d prediction_market_indexer -c \"SELECT signature, slot FROM prediction_market.market_instantiated ORDER BY slot DESC LIMIT 5\"'");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
