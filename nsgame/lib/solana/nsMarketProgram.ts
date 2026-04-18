import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from '@solana/web3.js'
import idl from './idl/ns_market.json'

// Hand-rolled TS client for the ns-market Anchor program. We avoid
// @coral-xyz/anchor's Program class because its Provider/Wallet abstraction
// fights the session-wallet signer (session is not an adapter-compliant
// Wallet). Direct instruction builders are simpler and keep the boundary
// with the session layer clean.

export const NS_MARKET_PROGRAM_ID = new PublicKey(idl.address)

// Pull each Anchor discriminator out of the IDL once at module load.
function discriminatorFor(name: string): Uint8Array {
  const ix = idl.instructions.find(i => i.name === name)
  if (!ix) throw new Error(`instruction '${name}' missing from IDL`)
  return Uint8Array.from(ix.discriminator)
}

const CREATE_MARKET_DISC = discriminatorFor('create_market')
const PLACE_BET_DISC = discriminatorFor('place_bet')
const RESOLVE_MARKET_DISC = discriminatorFor('resolve_market')
const REDEEM_DISC = discriminatorFor('redeem')

// PDA derivations — mirror the program's seeds exactly.
export function deriveMarketPda(marketId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market'), Buffer.from(marketId, 'utf8')],
    NS_MARKET_PROGRAM_ID,
  )
}

export function deriveBetPda(bettor: PublicKey, nonce: bigint): [PublicKey, number] {
  const nonceBytes = new Uint8Array(8)
  new DataView(nonceBytes.buffer).setBigUint64(0, nonce, true)
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), bettor.toBuffer(), Buffer.from(nonceBytes)],
    NS_MARKET_PROGRAM_ID,
  )
}

// --- Borsh encoders for instruction args -----------------------------------

function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, 'utf8')
  const out = Buffer.alloc(4 + bytes.length)
  out.writeUInt32LE(bytes.length, 0)
  bytes.copy(out, 4)
  return out
}

function encodeCreateMarket(
  marketId: string,
  question: string,
  closesAt: bigint,
  feeBps: number,
): Buffer {
  const idBuf = encodeString(marketId)
  const qBuf = encodeString(question)
  const closesBuf = Buffer.alloc(8)
  closesBuf.writeBigInt64LE(closesAt, 0)
  const feeBuf = Buffer.alloc(2)
  feeBuf.writeUInt16LE(feeBps, 0)
  return Buffer.concat([Buffer.from(CREATE_MARKET_DISC), idBuf, qBuf, closesBuf, feeBuf])
}

function encodePlaceBet(nonce: bigint, outcome: number, amountLamports: bigint): Buffer {
  const buf = Buffer.alloc(8 + 8 + 1 + 8)
  let o = 0
  Buffer.from(PLACE_BET_DISC).copy(buf, o); o += 8
  buf.writeBigUInt64LE(nonce, o); o += 8
  buf.writeUInt8(outcome, o); o += 1
  buf.writeBigUInt64LE(amountLamports, o)
  return buf
}

function encodeResolve(winningOutcome: number): Buffer {
  const buf = Buffer.alloc(8 + 1)
  Buffer.from(RESOLVE_MARKET_DISC).copy(buf, 0)
  buf.writeUInt8(winningOutcome, 8)
  return buf
}

function encodeRedeem(nonce: bigint): Buffer {
  const buf = Buffer.alloc(8 + 8)
  Buffer.from(REDEEM_DISC).copy(buf, 0)
  buf.writeBigUInt64LE(nonce, 8)
  return buf
}

// --- Instruction builders --------------------------------------------------

export interface CreateMarketOpts {
  // Unix timestamp (seconds) after which place_bet is rejected.
  // 0 means never.
  closesAt?: bigint
  // Protocol fee in basis points, deducted from each redeem and sent to
  // the market authority. 200 = 2%. 0 = no fee.
  feeBps?: number
}

export function buildCreateMarketTx(
  authority: PublicKey,
  marketId: string,
  question: string,
  opts: CreateMarketOpts = {},
): { tx: Transaction; marketPda: PublicKey } {
  if (marketId.length === 0 || marketId.length > 32) {
    throw new Error(`market_id must be 1..=32 bytes, got ${marketId.length}`)
  }
  if (question.length > 200) {
    throw new Error(`question must be <=200 bytes, got ${question.length}`)
  }
  const feeBps = opts.feeBps ?? 0
  if (feeBps < 0 || feeBps > 10_000) {
    throw new Error(`fee_bps must be 0..=10000, got ${feeBps}`)
  }
  const closesAt = opts.closesAt ?? 0n

  const [marketPda] = deriveMarketPda(marketId)
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: NS_MARKET_PROGRAM_ID,
    data: encodeCreateMarket(marketId, question, closesAt, feeBps),
  })
  return { tx: new Transaction().add(ix), marketPda }
}

export function buildPlaceBetTx(
  bettor: PublicKey,
  marketId: string,
  outcome: 0 | 1,
  amountSol: number,
  nonce: bigint = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)),
): { tx: Transaction; betPda: PublicKey; marketPda: PublicKey; nonce: bigint } {
  if (outcome !== 0 && outcome !== 1) throw new Error('outcome must be 0 or 1')
  const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL))
  if (amountLamports <= 0n) throw new Error('amount must be positive')

  const [marketPda] = deriveMarketPda(marketId)
  const [betPda] = deriveBetPda(bettor, nonce)

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: bettor, isSigner: true, isWritable: true },
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: betPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: NS_MARKET_PROGRAM_ID,
    data: encodePlaceBet(nonce, outcome, amountLamports),
  })
  return { tx: new Transaction().add(ix), betPda, marketPda, nonce }
}

export function buildResolveMarketTx(
  authority: PublicKey,
  marketId: string,
  winningOutcome: 0 | 1,
): { tx: Transaction; marketPda: PublicKey } {
  const [marketPda] = deriveMarketPda(marketId)
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
    ],
    programId: NS_MARKET_PROGRAM_ID,
    data: encodeResolve(winningOutcome),
  })
  return { tx: new Transaction().add(ix), marketPda }
}

export function buildRedeemTx(
  bettor: PublicKey,
  marketPda: PublicKey,
  // Authority is the market's creator — enforced on chain by address
  // equality with market.authority. Callers can read it via fetchMarket
  // if they only know the market_id.
  authority: PublicKey,
  nonce: bigint,
): { tx: Transaction; betPda: PublicKey } {
  const [betPda] = deriveBetPda(bettor, nonce)
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: bettor, isSigner: true, isWritable: true },
      { pubkey: betPda, isSigner: false, isWritable: true },
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: true },
    ],
    programId: NS_MARKET_PROGRAM_ID,
    data: encodeRedeem(nonce),
  })
  return { tx: new Transaction().add(ix), betPda }
}

// --- Account decoders ------------------------------------------------------

export interface MarketAccount {
  authority: PublicKey
  marketId: string
  question: string
  resolved: boolean
  winningOutcome: number // 0/1, or 255 = unresolved
  totalPool: bigint
  yesPool: bigint
  noPool: bigint
  createdAt: bigint
  closesAt: bigint          // 0 = never closes
  resolvedAt: bigint
  feeBps: number             // basis points, 200 = 2%
  feeCollected: bigint       // lamports sent to authority so far
  bump: number
}

export interface BetAccount {
  bettor: PublicKey
  market: PublicKey
  outcome: number
  amount: bigint
  timestamp: bigint
  redeemed: boolean
  bump: number
}

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset)
  const s = buf.slice(offset + 4, offset + 4 + len).toString('utf8')
  return [s, offset + 4 + len]
}

function decodeMarket(data: Buffer): MarketAccount {
  let o = 8 // skip discriminator
  const authority = new PublicKey(data.slice(o, o + 32)); o += 32
  const [marketId, afterMid] = readString(data, o); o = afterMid
  const [question, afterQ] = readString(data, o); o = afterQ
  const resolved = data.readUInt8(o) !== 0; o += 1
  const winningOutcome = data.readUInt8(o); o += 1
  const totalPool = data.readBigUInt64LE(o); o += 8
  const yesPool = data.readBigUInt64LE(o); o += 8
  const noPool = data.readBigUInt64LE(o); o += 8
  const createdAt = data.readBigInt64LE(o); o += 8
  const closesAt = data.readBigInt64LE(o); o += 8
  const resolvedAt = data.readBigInt64LE(o); o += 8
  const feeBps = data.readUInt16LE(o); o += 2
  const feeCollected = data.readBigUInt64LE(o); o += 8
  const bump = data.readUInt8(o)
  return {
    authority, marketId, question, resolved, winningOutcome,
    totalPool, yesPool, noPool, createdAt, closesAt, resolvedAt,
    feeBps, feeCollected, bump,
  }
}

function decodeBet(data: Buffer): BetAccount {
  let o = 8
  const bettor = new PublicKey(data.slice(o, o + 32)); o += 32
  const market = new PublicKey(data.slice(o, o + 32)); o += 32
  const outcome = data.readUInt8(o); o += 1
  const amount = data.readBigUInt64LE(o); o += 8
  const timestamp = data.readBigInt64LE(o); o += 8
  const redeemed = data.readUInt8(o) !== 0; o += 1
  const bump = data.readUInt8(o)
  return { bettor, market, outcome, amount, timestamp, redeemed, bump }
}

export async function fetchMarket(
  connection: Connection,
  marketIdOrPda: string | PublicKey,
): Promise<MarketAccount | null> {
  const pda = typeof marketIdOrPda === 'string' ? deriveMarketPda(marketIdOrPda)[0] : marketIdOrPda
  const info = await connection.getAccountInfo(pda)
  if (!info) return null
  return decodeMarket(info.data)
}

export async function fetchBet(
  connection: Connection,
  betPda: PublicKey,
): Promise<BetAccount | null> {
  const info = await connection.getAccountInfo(betPda)
  if (!info) return null
  return decodeBet(info.data)
}

// Uses getProgramAccounts with a size filter (Bet is exactly 8 + 83 bytes)
// and a memcmp at offset 8 for the bettor pubkey. Returns every bet owned
// by `bettor`, across all markets.
export async function fetchBetsForBettor(
  connection: Connection,
  bettor: PublicKey,
): Promise<Array<{ pda: PublicKey; data: BetAccount }>> {
  const BET_TOTAL_SIZE = 8 + 83 // discriminator + Bet::LEN
  const accounts = await connection.getProgramAccounts(NS_MARKET_PROGRAM_ID, {
    filters: [
      { dataSize: BET_TOTAL_SIZE },
      { memcmp: { offset: 8, bytes: bettor.toBase58() } },
    ],
  })
  return accounts.map(({ pubkey, account }) => ({
    pda: pubkey,
    data: decodeBet(account.data),
  }))
}
