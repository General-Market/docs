import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import idl from './idl/prediction_market.json'
import type {
  PlaceBetArgs,
  ExitBetArgs,
  BatchEntry,
  Side,
} from './idl/prediction_market'

// Hand-rolled TS client for the prediction-market Anchor program. We
// avoid @coral-xyz/anchor's Program class because its Provider/Wallet
// abstraction fights the session-wallet signer (session is not an
// adapter-compliant Wallet). Direct instruction builders are simpler and
// keep the boundary with the session layer clean.

export const PREDICTION_MARKET_PROGRAM_ID = new PublicKey(idl.address)

// Discriminators are zero placeholders in the stub IDL. Once anchor build
// fills them in, readers here pick them up automatically.
// TODO: replace placeholder zeros when the program ships.
function discriminatorFor(name: string): Uint8Array {
  const ix = idl.instructions.find(i => i.name === name)
  if (!ix) throw new Error(`instruction '${name}' missing from IDL`)
  return Uint8Array.from(ix.discriminator)
}

const PLACE_BET_DISC = discriminatorFor('place_bet')
const EXIT_BET_DISC = discriminatorFor('exit_bet')
const BATCH_BETS_DISC = discriminatorFor('batch_bets')

// --- PDA derivations --------------------------------------------------------
// Seed encodings mirror the program's byte layout. All integers are
// little-endian; i64/u32/i32 are fixed-width per their Rust type.

function u32LE(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}
function i32LE(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setInt32(0, n, true)
  return b
}
function i64LE(n: bigint): Uint8Array {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigInt64(0, n, true)
  return b
}
function u64LE(n: bigint): Uint8Array {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, n, true)
  return b
}
function u128LE(n: bigint): Uint8Array {
  const b = new Uint8Array(16)
  const view = new DataView(b.buffer)
  const mask = (1n << 64n) - 1n
  view.setBigUint64(0, n & mask, true)
  view.setBigUint64(8, (n >> 64n) & mask, true)
  return b
}

export function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PREDICTION_MARKET_PROGRAM_ID,
  )
}

export function deriveFeeVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault')],
    PREDICTION_MARKET_PROGRAM_ID,
  )
}

export function deriveSourcePda(sourceId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('source'), u32LE(sourceId)],
    PREDICTION_MARKET_PROGRAM_ID,
  )
}

export interface MarketSeedParams {
  sourceId: number
  closeTime: bigint
  settlementTime: bigint
  thresholdBps: number
}

export function deriveMarketPda(params: MarketSeedParams): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('market'),
      u32LE(params.sourceId),
      i64LE(params.closeTime),
      i64LE(params.settlementTime),
      i32LE(params.thresholdBps),
    ],
    PREDICTION_MARKET_PROGRAM_ID,
  )
}

export function derivePositionPda(
  market: PublicKey,
  owner: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), market.toBuffer(), owner.toBuffer()],
    PREDICTION_MARKET_PROGRAM_ID,
  )
}

export function deriveVaultPda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), market.toBuffer()],
    PREDICTION_MARKET_PROGRAM_ID,
  )
}

// --- Side encoding ----------------------------------------------------------

function sideByte(s: Side): number {
  return s === 'Yes' ? 0 : 1
}

// --- Borsh encoders ---------------------------------------------------------

function encodePlaceBet(args: PlaceBetArgs): Buffer {
  const parts = [
    PLACE_BET_DISC,
    u32LE(args.sourceId),
    i64LE(args.closeTime),
    i64LE(args.settlementTime),
    i32LE(args.thresholdBps),
    new Uint8Array([sideByte(args.side)]),
    u64LE(args.amount),
  ]
  return Buffer.concat(parts.map(p => Buffer.from(p)))
}

function encodeExitBet(args: ExitBetArgs): Buffer {
  const parts = [
    EXIT_BET_DISC,
    new Uint8Array([sideByte(args.side)]),
    u64LE(args.amount),
  ]
  return Buffer.concat(parts.map(p => Buffer.from(p)))
}

function encodeBatchBets(entries: readonly BatchEntry[]): Buffer {
  const lenPrefix = u32LE(entries.length)
  const entryParts: Uint8Array[] = []
  for (const e of entries) {
    entryParts.push(u32LE(e.sourceId))
    entryParts.push(i64LE(e.closeTime))
    entryParts.push(i64LE(e.settlementTime))
    entryParts.push(i32LE(e.thresholdBps))
    entryParts.push(new Uint8Array([sideByte(e.side)]))
    entryParts.push(u64LE(e.amount))
  }
  return Buffer.concat([
    Buffer.from(BATCH_BETS_DISC),
    Buffer.from(lenPrefix),
    ...entryParts.map(p => Buffer.from(p)),
  ])
}

// --- Instruction builders ---------------------------------------------------

export interface PlaceBetBuildResult {
  tx: Transaction
  marketPda: PublicKey
  positionPda: PublicKey
  vaultPda: PublicKey
  userAta: PublicKey
  sourcePda: PublicKey
}

export function buildPlaceBetTx(
  user: PublicKey,
  stakeMint: PublicKey,
  args: PlaceBetArgs,
): PlaceBetBuildResult {
  validatePlaceBet(args)

  const [configPda] = deriveConfigPda()
  const [sourcePda] = deriveSourcePda(args.sourceId)
  const [marketPda] = deriveMarketPda({
    sourceId: args.sourceId,
    closeTime: args.closeTime,
    settlementTime: args.settlementTime,
    thresholdBps: args.thresholdBps,
  })
  const [positionPda] = derivePositionPda(marketPda, user)
  const [vaultPda] = deriveVaultPda(marketPda)
  const userAta = getAssociatedTokenAddressSync(stakeMint, user, true)

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: sourcePda, isSigner: false, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: stakeMint, isSigner: false, isWritable: false },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PREDICTION_MARKET_PROGRAM_ID,
    data: encodePlaceBet(args),
  })

  return {
    tx: new Transaction().add(ix),
    marketPda,
    positionPda,
    vaultPda,
    userAta,
    sourcePda,
  }
}

export interface ExitBetBuildInput extends MarketSeedParams, ExitBetArgs {}

export function buildExitBetTx(
  user: PublicKey,
  stakeMint: PublicKey,
  input: ExitBetBuildInput,
): { tx: Transaction; marketPda: PublicKey; positionPda: PublicKey } {
  const [marketPda] = deriveMarketPda(input)
  const [positionPda] = derivePositionPda(marketPda, user)
  const [vaultPda] = deriveVaultPda(marketPda)
  const userAta = getAssociatedTokenAddressSync(stakeMint, user, true)

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PREDICTION_MARKET_PROGRAM_ID,
    data: encodeExitBet({ side: input.side, amount: input.amount }),
  })
  return { tx: new Transaction().add(ix), marketPda, positionPda }
}

// batch_bets is ALT-friendly: the entries carry full bet params and the
// program walks `remaining_accounts` in 4-account strides (market,
// position, vault, user_ata). Callers should build a v0 tx with an ALT
// when batch depth exceeds ~4 — but the raw instruction returned here
// works identically in legacy v0 and versioned form.
export interface BatchBetsBuildResult {
  ix: TransactionInstruction
  /** Stride-4 pubkeys: [market, position, vault, user_ata] per entry. */
  remainingAccounts: Array<{
    pubkey: PublicKey
    isSigner: false
    isWritable: true
  }>
}

export function buildBatchBetsIx(
  user: PublicKey,
  stakeMint: PublicKey,
  entries: readonly BatchEntry[],
): BatchBetsBuildResult {
  if (entries.length === 0) throw new Error('batch_bets: entries must not be empty')

  const [configPda] = deriveConfigPda()

  const remaining: BatchBetsBuildResult['remainingAccounts'] = []
  for (const e of entries) {
    validatePlaceBet(e)
    const [marketPda] = deriveMarketPda(e)
    const [positionPda] = derivePositionPda(marketPda, user)
    const [vaultPda] = deriveVaultPda(marketPda)
    const userAta = getAssociatedTokenAddressSync(stakeMint, user, true)
    remaining.push(
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
    )
  }

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ...remaining,
    ],
    programId: PREDICTION_MARKET_PROGRAM_ID,
    data: encodeBatchBets(entries),
  })
  return { ix, remainingAccounts: remaining }
}

// --- Client-side validation (mirrors MR3) -----------------------------------

const MAX_TTL_SECS = 30n * 86_400n

export function validatePlaceBet(args: {
  thresholdBps: number
  closeTime: bigint
  settlementTime: bigint
}): void {
  const { thresholdBps, closeTime, settlementTime } = args
  if (thresholdBps === 0) throw new Error('thresholdBps must be non-zero')
  if (Math.abs(thresholdBps) > 10_000)
    throw new Error(`|thresholdBps| must be <= 10000, got ${thresholdBps}`)
  const nowSecs = BigInt(Math.floor(Date.now() / 1000))
  if (closeTime - nowSecs < 10n)
    throw new Error('closeTime must be at least 10s in the future')
  if (settlementTime - closeTime < 10n)
    throw new Error('settlementTime must be at least 10s after closeTime')
  if (settlementTime - nowSecs > MAX_TTL_SECS)
    throw new Error('settlementTime must be at most 30d in the future')
}

// --- Account decoders -------------------------------------------------------
// Fixed layouts. Hand-decoded; the Anchor IDL's codec layer is not loaded.

export interface SourceAccount {
  sourceId: number
  name: string
  enabled: boolean
  bump: number
}

export interface MarketAccount {
  sourceId: number
  closeTime: bigint
  settlementTime: bigint
  thresholdBps: number
  totalYes: bigint
  totalNo: bigint
  baselinePrice: bigint
  finalPrice: bigint
  resolved: boolean
  outcomeYes: boolean
  forceResolved: boolean
  vault: PublicKey
  bump: number
}

export interface PositionAccount {
  market: PublicKey
  owner: PublicKey
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
  bump: number
}

function readU128LE(buf: Buffer, offset: number): bigint {
  const lo = buf.readBigUInt64LE(offset)
  const hi = buf.readBigUInt64LE(offset + 8)
  return (hi << 64n) | lo
}

function decodeFixedName(bytes: Buffer): string {
  // Strip trailing zeros from a [u8; 32] name field.
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  return bytes.slice(0, end).toString('utf8')
}

export function decodeSource(data: Buffer): SourceAccount {
  let o = 8
  const sourceId = data.readUInt32LE(o); o += 4
  const name = decodeFixedName(data.slice(o, o + 32)); o += 32
  const enabled = data.readUInt8(o) !== 0; o += 1
  const bump = data.readUInt8(o)
  return { sourceId, name, enabled, bump }
}

export function decodeMarket(data: Buffer): MarketAccount {
  let o = 8
  const sourceId = data.readUInt32LE(o); o += 4
  const closeTime = data.readBigInt64LE(o); o += 8
  const settlementTime = data.readBigInt64LE(o); o += 8
  const thresholdBps = data.readInt32LE(o); o += 4
  const totalYes = data.readBigUInt64LE(o); o += 8
  const totalNo = data.readBigUInt64LE(o); o += 8
  const baselinePrice = readU128LE(data, o); o += 16
  const finalPrice = readU128LE(data, o); o += 16
  const resolved = data.readUInt8(o) !== 0; o += 1
  const outcomeYes = data.readUInt8(o) !== 0; o += 1
  const forceResolved = data.readUInt8(o) !== 0; o += 1
  const vault = new PublicKey(data.slice(o, o + 32)); o += 32
  const bump = data.readUInt8(o)
  return {
    sourceId, closeTime, settlementTime, thresholdBps,
    totalYes, totalNo, baselinePrice, finalPrice,
    resolved, outcomeYes, forceResolved, vault, bump,
  }
}

export function decodePosition(data: Buffer): PositionAccount {
  let o = 8
  const market = new PublicKey(data.slice(o, o + 32)); o += 32
  const owner = new PublicKey(data.slice(o, o + 32)); o += 32
  const yesAmount = data.readBigUInt64LE(o); o += 8
  const noAmount = data.readBigUInt64LE(o); o += 8
  const claimed = data.readUInt8(o) !== 0; o += 1
  const bump = data.readUInt8(o)
  return { market, owner, yesAmount, noAmount, claimed, bump }
}

// --- Account fetchers -------------------------------------------------------

export async function fetchSource(
  connection: Connection,
  sourceId: number,
): Promise<SourceAccount | null> {
  const [pda] = deriveSourcePda(sourceId)
  const info = await connection.getAccountInfo(pda)
  if (!info) return null
  return decodeSource(info.data)
}

export async function fetchMarket(
  connection: Connection,
  params: MarketSeedParams,
): Promise<MarketAccount | null> {
  const [pda] = deriveMarketPda(params)
  const info = await connection.getAccountInfo(pda)
  if (!info) return null
  return decodeMarket(info.data)
}

export async function fetchPosition(
  connection: Connection,
  marketPda: PublicKey,
  owner: PublicKey,
): Promise<PositionAccount | null> {
  const [pda] = derivePositionPda(marketPda, owner)
  const info = await connection.getAccountInfo(pda)
  if (!info) return null
  return decodePosition(info.data)
}

// Returns every Position owned by `owner`, across all markets. Filters
// by exact account size and memcmps the owner pubkey at the Position
// struct's `owner` field offset (8 discriminator + 32 market = 40).
export async function fetchPositionsForOwner(
  connection: Connection,
  owner: PublicKey,
): Promise<Array<{ pda: PublicKey; data: PositionAccount }>> {
  // 8 disc + 32 market + 32 owner + 8 yes + 8 no + 1 claimed + 1 bump
  const POSITION_SIZE = 8 + 32 + 32 + 8 + 8 + 1 + 1
  const accounts = await connection.getProgramAccounts(
    PREDICTION_MARKET_PROGRAM_ID,
    {
      filters: [
        { dataSize: POSITION_SIZE },
        { memcmp: { offset: 8 + 32, bytes: owner.toBase58() } },
      ],
    },
  )
  return accounts.map(({ pubkey, account }) => ({
    pda: pubkey,
    data: decodePosition(account.data),
  }))
}
