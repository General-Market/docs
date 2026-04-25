/**
 * Source-id migration — runs once.
 *
 * Repurposes the three crypto-named source PDAs deployed during bootstrap
 * and adds two new tube source PDAs. Idempotent: upsert_source overwrites
 * name + enabled state in place. The PDA addresses do not change.
 *
 * Migration:
 *   1. upsert_source(1, "tubes_xv", true)   — was BTC/USD
 *   2. upsert_source(2, "tubes_xn", true)   — was ETH/USD
 *   3. upsert_source(3, "tubes_ph", true)   — was SOL/USD
 *   4. upsert_source(4, "tubes_cb", true)   — new
 *   5. upsert_source(5, "tubes_ep", true)   — new
 *
 * Env vars:
 *   SOLANA_URL     — optional, defaults to Helius devnet
 *   ANCHOR_WALLET  — optional, defaults to ~/.config/solana/id.json
 *
 * The admin key is the wallet at ANCHOR_WALLET. It must be the same key that
 * signed initialize_config — anything else fails has_one = admin.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  AnchorProvider,
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

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(PROJECT_ROOT, "target", "idl", "prediction_market.json");

const RPC_URL = process.env.SOLANA_URL ?? "https://api.devnet.solana.com";

function loadDefaultKeypair(): Keypair {
  const kpPath = process.env.ANCHOR_WALLET
    ?? path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(kpPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

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
  console.log(`rpc         : ${RPC_URL}`);
  console.log("");

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
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

  const sources: Array<{ id: number; name: string; previous: string | null }> = [
    { id: 1, name: "tubes_xv", previous: "BTC/USD" },
    { id: 2, name: "tubes_xn", previous: "ETH/USD" },
    { id: 3, name: "tubes_ph", previous: "SOL/USD" },
    { id: 4, name: "tubes_cb", previous: null },
    { id: 5, name: "tubes_ep", previous: null },
  ];

  for (const s of sources) {
    const pda = sourcePda(s.id);
    const exists = await connection.getAccountInfo(pda);
    const action = exists ? `repurpose (was ${s.previous ?? "?"})` : "create";
    console.log(`==> upsert_source id=${s.id} name=${s.name} — ${action}`);
    console.log(`   pda ${pda.toBase58()}`);

    const sig = await (program.methods as any)
      .upsertSource(s.id, pad32(s.name), true)
      .accountsPartial({
        config: configPda,
        source: pda,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   tx ${sig}`);
  }

  console.log("");
  console.log("-------------------------------------------------------------------------------");
  console.log(" source migration complete");
  console.log("-------------------------------------------------------------------------------");
  for (const s of sources) {
    console.log(` id=${s.id}  ${s.name.padEnd(10)}  ${sourcePda(s.id).toBase58()}`);
  }
  console.log("-------------------------------------------------------------------------------");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
