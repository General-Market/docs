/**
 * e2e-two-sided.ts — fires a market with bets on BOTH sides.
 *
 * Two keypairs, same market PDA, opposite sides. Admin places YES,
 * nsgame-dev1 places NO. After close + settle, the program either
 *   - dispatches the loser's pool to the winner (real PnL), or
 *   - refunds both if the parimutuel "stranded" path triggers (which
 *     should NOT happen here — both sides have liquidity).
 *
 * Pre-conditions:
 *   - Admin keypair at ~/.config/solana/id.json with stake-mint balance
 *   - dev1 keypair at ~/.config/solana/nsgame-dev1.json with SOL
 *
 * Side effects:
 *   - Mints 5 stake-mint tokens to dev1's ATA (creates ATA if missing)
 *
 * Env:
 *   SOLANA_URL  — defaults to Helius devnet
 *   SOURCE_ID   — defaults to 3 (tubes_ph)
 *   THRESHOLD   — defaults to 1 (positive — YES wins on rise)
 *   AMOUNT      — defaults to 1_000_000 per side (1.0 stake @ 6 dec)
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
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
} from "@solana/spl-token";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(PROJECT_ROOT, "target", "idl", "prediction_market.json");

const RPC_URL = process.env.SOLANA_URL ?? "https://api.devnet.solana.com";
const SOURCE_ID = Number(process.env.SOURCE_ID ?? "3");
const THRESHOLD = Number(process.env.THRESHOLD ?? "1");
const AMOUNT = BigInt(process.env.AMOUNT ?? "1000000");

function loadKeypair(p: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function alignToGrid(ts: number): number {
  return Math.ceil(ts / 60) * 60;
}

async function placeBet(
  program: Program,
  programId: PublicKey,
  signer: Keypair,
  args: {
    sourceId: number;
    closeTime: number;
    settlementTime: number;
    thresholdBps: number;
    side: "yes" | "no";
    amount: bigint;
  },
  configPda: PublicKey,
  sourcePda: PublicKey,
  stakeMint: PublicKey,
): Promise<{ sig: string; market: PublicKey }> {
  const sourceIdBuf = Buffer.alloc(4);
  sourceIdBuf.writeUInt32LE(args.sourceId, 0);
  const closeBuf = Buffer.alloc(8);
  closeBuf.writeBigInt64LE(BigInt(args.closeTime), 0);
  const settleBuf = Buffer.alloc(8);
  settleBuf.writeBigInt64LE(BigInt(args.settlementTime), 0);
  const thresholdBuf = Buffer.alloc(4);
  thresholdBuf.writeInt32LE(args.thresholdBps, 0);

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), sourceIdBuf, closeBuf, settleBuf, thresholdBuf],
    programId,
  );
  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), marketPda.toBuffer(), signer.publicKey.toBuffer()],
    programId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPda.toBuffer()],
    programId,
  );
  const userAta = getAssociatedTokenAddressSync(stakeMint, signer.publicKey);

  const sig = await (program.methods as any)
    .placeBet({
      sourceId: args.sourceId,
      closeTime: new BN(args.closeTime),
      settlementTime: new BN(args.settlementTime),
      thresholdBps: args.thresholdBps,
      side: { [args.side]: {} },
      amount: new BN(args.amount.toString()),
    })
    .accountsPartial({
      config: configPda,
      source: sourcePda,
      market: marketPda,
      position: positionPda,
      vault: vaultPda,
      stakeMint,
      userAta,
      user: signer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([signer])
    .rpc();

  return { sig, market: marketPda };
}

async function main(): Promise<void> {
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8")) as Idl & {
    address: string;
  };
  const programId = new PublicKey(idl.address);

  const connection = new Connection(RPC_URL, "confirmed");
  const admin = loadKeypair(path.join(os.homedir(), ".config", "solana", "id.json"));
  const dev1 = loadKeypair(path.join(os.homedir(), ".config", "solana", "nsgame-dev1.json"));

  // Use admin as the provider's default wallet for fetches; we sign each bet
  // explicitly with the right keypair.
  const provider = new AnchorProvider(connection, new Wallet(admin), {
    commitment: "confirmed",
  });
  const program = new Program(idl as Idl, provider);

  console.log(`program  : ${programId.toBase58()}`);
  console.log(`admin    : ${admin.publicKey.toBase58()}`);
  console.log(`dev1     : ${dev1.publicKey.toBase58()}`);
  console.log(`rpc      : ${RPC_URL}`);
  console.log("");

  // ---- Config + stake mint -----------------------------------------------
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

  const globalConfig = await (program.account as any).globalConfig.fetch(configPda);
  const stakeMint = new PublicKey(globalConfig.stakeMint);
  console.log(`stake mint: ${stakeMint.toBase58()}`);

  // ---- Mint stake tokens to dev1 -----------------------------------------
  const dev1Ata = getAssociatedTokenAddressSync(stakeMint, dev1.publicKey);
  console.log(`dev1 ata : ${dev1Ata.toBase58()}`);

  const mintTx = new Transaction()
    .add(
      createAssociatedTokenAccountIdempotentInstruction(
        admin.publicKey,
        dev1Ata,
        dev1.publicKey,
        stakeMint,
      ),
    )
    .add(
      createMintToInstruction(
        stakeMint,
        dev1Ata,
        admin.publicKey,
        Number(AMOUNT * BigInt(5)),
      ),
    );
  const mintSig = await provider.sendAndConfirm(mintTx, [admin]);
  console.log(`mint to dev1: ${mintSig}`);
  console.log("");

  // ---- Window: aligned to 60s grid ---------------------------------------
  const nowSecs = Math.floor(Date.now() / 1000);
  const closeTime = alignToGrid(nowSecs + 30);
  const settlementTime = closeTime + 60;
  console.log(`now         : ${nowSecs}  (${new Date(nowSecs * 1000).toISOString()})`);
  console.log(`close_time  : ${closeTime}  (+${closeTime - nowSecs}s)`);
  console.log(`settle_time : ${settlementTime}  (+${settlementTime - nowSecs}s)`);
  console.log(`threshold   : ${THRESHOLD}`);
  console.log(`amount      : ${AMOUNT} per side`);
  console.log("");

  // ---- Two place_bet calls ----------------------------------------------
  console.log("==> admin places YES");
  const { sig: yesSig, market: marketPda } = await placeBet(
    program,
    programId,
    admin,
    {
      sourceId: SOURCE_ID,
      closeTime,
      settlementTime,
      thresholdBps: THRESHOLD,
      side: "yes",
      amount: AMOUNT,
    },
    configPda,
    sourcePda,
    stakeMint,
  );
  console.log(`   tx ${yesSig}`);
  console.log(`   market ${marketPda.toBase58()}`);

  console.log("==> dev1 places NO");
  const { sig: noSig } = await placeBet(
    program,
    programId,
    dev1,
    {
      sourceId: SOURCE_ID,
      closeTime,
      settlementTime,
      thresholdBps: THRESHOLD,
      side: "no",
      amount: AMOUNT,
    },
    configPda,
    sourcePda,
    stakeMint,
  );
  console.log(`   tx ${noSig}`);

  console.log("");
  console.log("-------------------------------------------------------------------------------");
  console.log(" both bets placed. wait ~30s close, ~60s more settle.");
  console.log("-------------------------------------------------------------------------------");
  console.log(` market         : ${marketPda.toBase58()}`);
  console.log(` close_time     : ${closeTime}`);
  console.log(` settlement_time: ${settlementTime}`);
  console.log(` total wait     : ~${settlementTime - nowSecs}s`);
  console.log("-------------------------------------------------------------------------------");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
