import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from '@solana/web3.js'
import idl from './idl/ns_market.json'

// Hand-rolled TS client for the ns-market Anchor program. Could use
// @coral-xyz/anchor's `Program` class, but that drags a Provider + Wallet
// abstraction which fights the session-wallet flow (session is not an
// adapter-compliant Wallet). A direct instruction builder is simpler and
// keeps the boundary with the session layer clean.

export const NS_MARKET_PROGRAM_ID = new PublicKey(idl.address)

// Anchor derives instruction discriminators from `sha256("global:<name>")[:8]`.
// We precompute the bytes from the IDL so we don't have to call hash at
// every transaction. place_bet's discriminator is fixed by name.
const PLACE_BET_DISCRIMINATOR = (() => {
  const found = idl.instructions.find(i => i.name === 'place_bet')
  if (!found) throw new Error('place_bet missing from IDL')
  return Uint8Array.from(found.discriminator)
})()

// Bet account derivation — matches the program's seeds:
//   [b"bet", bettor.as_ref(), &nonce.to_le_bytes()]
export function deriveBetPda(bettor: PublicKey, nonce: bigint): [PublicKey, number] {
  const nonceBytes = new Uint8Array(8)
  const view = new DataView(nonceBytes.buffer)
  view.setBigUint64(0, nonce, true) // little-endian
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), bettor.toBuffer(), Buffer.from(nonceBytes)],
    NS_MARKET_PROGRAM_ID,
  )
}

// Builds the place_bet instruction.
// Args encoded in borsh order: nonce: u64, market_id: String, outcome: u8, amount: u64
function encodePlaceBetData(
  nonce: bigint,
  marketId: string,
  outcome: number,
  amountLamports: bigint,
): Buffer {
  const marketBytes = Buffer.from(marketId, 'utf8')
  const buf = Buffer.alloc(8 + 8 + 4 + marketBytes.length + 1 + 8)
  let offset = 0
  PLACE_BET_DISCRIMINATOR.forEach((b, i) => (buf[offset + i] = b))
  offset += 8
  // nonce u64 LE
  buf.writeBigUInt64LE(nonce, offset)
  offset += 8
  // market_id: String — 4-byte length + utf8 bytes
  buf.writeUInt32LE(marketBytes.length, offset)
  offset += 4
  marketBytes.copy(buf, offset)
  offset += marketBytes.length
  // outcome u8
  buf.writeUInt8(outcome, offset)
  offset += 1
  // amount u64 LE
  buf.writeBigUInt64LE(amountLamports, offset)
  return buf
}

export function buildPlaceBetTx(
  bettor: PublicKey,
  marketId: string,
  outcome: 0 | 1,
  amountSol: number,
  // Client-side nonce to give each bet a unique PDA. Using a timestamp +
  // random is collision-safe for a single user at typical throughput.
  nonce: bigint = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)),
): { tx: Transaction; betPda: PublicKey; nonce: bigint } {
  if (marketId.length === 0 || marketId.length > 32) {
    throw new Error(`market_id must be 1..=32 bytes, got ${marketId.length}`)
  }
  if (outcome !== 0 && outcome !== 1) {
    throw new Error(`outcome must be 0 (YES) or 1 (NO)`)
  }
  const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL))
  if (amountLamports <= 0n) throw new Error('amount must be positive')

  const [betPda] = deriveBetPda(bettor, nonce)
  const data = encodePlaceBetData(nonce, marketId, outcome, amountLamports)

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: bettor, isSigner: true, isWritable: true },
      { pubkey: betPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: NS_MARKET_PROGRAM_ID,
    data,
  })

  const tx = new Transaction().add(ix)
  return { tx, betPda, nonce }
}

// Reads a Bet account and decodes it. Returns null if the account doesn't
// exist yet (e.g. right after submit, before confirmation).
export interface BetAccount {
  bettor: PublicKey
  marketId: string
  outcome: number
  amount: bigint
  timestamp: bigint
  redeemed: boolean
  bump: number
}

export async function fetchBet(
  connection: Connection,
  betPda: PublicKey,
): Promise<BetAccount | null> {
  const info = await connection.getAccountInfo(betPda)
  if (!info) return null
  return decodeBetAccount(info.data)
}

function decodeBetAccount(data: Buffer | Uint8Array): BetAccount {
  const buf = Buffer.from(data)
  // Skip 8-byte Anchor discriminator, then borsh-decode Bet struct.
  let offset = 8
  const bettor = new PublicKey(buf.slice(offset, offset + 32))
  offset += 32
  const marketIdLen = buf.readUInt32LE(offset)
  offset += 4
  const marketId = buf.slice(offset, offset + marketIdLen).toString('utf8')
  offset += marketIdLen
  const outcome = buf.readUInt8(offset)
  offset += 1
  const amount = buf.readBigUInt64LE(offset)
  offset += 8
  const timestamp = buf.readBigInt64LE(offset)
  offset += 8
  const redeemed = buf.readUInt8(offset) !== 0
  offset += 1
  const bump = buf.readUInt8(offset)
  return { bettor, marketId, outcome, amount, timestamp, redeemed, bump }
}

