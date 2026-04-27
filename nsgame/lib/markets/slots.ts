/**
 * Slot generator. Walks each catalog entry forward by its
 * `closeOffsetSecs` stride from `nowSecs`, snaps every close-time to the
 * 60s grid the program enforces, and derives the deterministic Market
 * PDA for each slot.
 *
 * The PDA derivation is unchanged from the pre-PvP build — the program
 * still sees `(source_id, close, settle, threshold_bps)`. Pair identity
 * is smuggled in via `threshold_bps == pairIndex`.
 *
 *   seeds = [b"market", source_id_le_u32, close_le_i64, settle_le_i64,
 *            threshold_le_i32]
 */

import { PublicKey } from '@solana/web3.js'
import type { CatalogEntry } from './catalog'
import type { Board, PvpFormat } from './pairs'

export interface UpcomingSlot {
  catalogId: string
  sourceId: number
  sourceName: string
  label: string
  description: string
  /** Single-line hook rendered on the market card under the title. */
  hook: string
  /** thresholdBps == pairIndex for PvP markets. */
  thresholdBps: number
  pairIndex: number
  board: Board
  format: PvpFormat
  displayA: string
  displayB: string
  slugA: string
  slugB: string
  audienceA: bigint
  audienceB: bigint
  windowSecs: number
  /** unix seconds, snapped to the 60s grid. */
  closeTime: number
  /** unix seconds. settle = close + (settleOffsetSecs - closeOffsetSecs). */
  settlementTime: number
  /** base58 of the deterministic Market PDA. */
  marketPda: string
}

export interface GenerateSlotsOpts {
  catalog: readonly CatalogEntry[]
  /** Unix seconds. Starting point for slot generation. */
  nowSecs: number
  /** How far ahead to project, in days. Default 7. */
  horizonDays?: number
  /** The on-chain program id, used for PDA derivation. */
  programId: PublicKey
  /**
   * Board filter. `all` includes both stars and cams. Internally maps to
   * source_id 1 (stars) or 4 (cams).
   */
  board?: Board | 'all'
  /** Soft cap on slots per catalog entry. Default 200. */
  maxSlotsPerEntry?: number
}

const DEFAULT_HORIZON_DAYS = 7
const DEFAULT_MAX_SLOTS_PER_ENTRY = 200

function snapUpToMinute(unixSecs: number): number {
  return Math.ceil(unixSecs / 60) * 60
}

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

export function deriveMarketPdaSync(
  programId: PublicKey,
  params: { sourceId: number; closeTime: number; settlementTime: number; thresholdBps: number },
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('market'),
      u32LE(params.sourceId),
      i64LE(BigInt(params.closeTime)),
      i64LE(BigInt(params.settlementTime)),
      i32LE(params.thresholdBps),
    ],
    programId,
  )
  return pda
}

export function generateSlots(opts: GenerateSlotsOpts): UpcomingSlot[] {
  const {
    catalog,
    nowSecs,
    horizonDays = DEFAULT_HORIZON_DAYS,
    programId,
    board = 'all',
    maxSlotsPerEntry = DEFAULT_MAX_SLOTS_PER_ENTRY,
  } = opts

  const horizonSecs = nowSecs + horizonDays * 86_400
  const out: UpcomingSlot[] = []

  for (const entry of catalog) {
    if (board !== 'all' && entry.board !== board) continue
    if (entry.windowSecs <= 0) continue

    // PvP cohort alignment. Each pair has exactly one live cohort: the
    // current windowSecs slot. Bets accept for closeOffsetSecs from
    // cohort start, then the cohort locks until settleOffsetSecs from
    // cohort start. Stars: 1 h open / 3 h locked, settle at end of the
    // 4 h cycle. Cams: full window open, settle close+60 s.
    //
    // The on-chain PDA is derived from (close, settle, threshold) so we
    // must produce identical values here, in the bot, and inside the
    // oracle's scanner. Cohort start uses the same floor() math everywhere.
    const cohortStart = Math.floor(nowSecs / entry.windowSecs) * entry.windowSecs
    let close = cohortStart + entry.closeOffsetSecs
    let settle = cohortStart + entry.settleOffsetSecs

    // If the bet window for this cohort already ended (or is within the
    // 10 s rejection cushion the program enforces), move to the next
    // cohort. The current one will surface in settling/resolved feeds
    // separately, not in the live betting list.
    if (close - nowSecs < 10) {
      const nextStart = cohortStart + entry.windowSecs
      close = nextStart + entry.closeOffsetSecs
      settle = nextStart + entry.settleOffsetSecs
    }
    if (close > horizonSecs) continue
    if (close % 60 !== 0) continue
    if (settle % 60 !== 0) continue
    const pda = deriveMarketPdaSync(programId, {
      sourceId: entry.sourceId,
      closeTime: close,
      settlementTime: settle,
      thresholdBps: entry.thresholdBps,
    })
    out.push({
      catalogId: entry.id,
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      label: entry.label,
      description: entry.description,
      hook: entry.hook,
      thresholdBps: entry.thresholdBps,
      pairIndex: entry.pairIndex,
      board: entry.board,
      format: entry.format,
      displayA: entry.displayA,
      displayB: entry.displayB,
      slugA: entry.slugA,
      slugB: entry.slugB,
      audienceA: entry.audienceA,
      audienceB: entry.audienceB,
      windowSecs: entry.windowSecs,
      closeTime: close,
      settlementTime: settle,
      marketPda: pda.toBase58(),
    })
    void maxSlotsPerEntry
  }

  // Sort each board by combined audience descending — most popular first
  // within its own scale (cams count viewers, stars count views — different
  // currencies). Then interleave the two boards so the page doesn't open
  // on a wall of one type. Resolved markets sink to the bottom.
  const stars: UpcomingSlot[] = []
  const cams: UpcomingSlot[] = []
  const others: UpcomingSlot[] = []
  for (const s of out) {
    if (s.board === 'stars') stars.push(s)
    else if (s.board === 'cams') cams.push(s)
    else others.push(s)
  }
  const byPopularityDesc = (a: UpcomingSlot, b: UpcomingSlot) => {
    const popA = a.audienceA + a.audienceB
    const popB = b.audienceA + b.audienceB
    if (popA !== popB) return popB > popA ? 1 : -1
    return a.closeTime - b.closeTime
  }
  stars.sort(byPopularityDesc)
  cams.sort(byPopularityDesc)
  others.sort(byPopularityDesc)

  // Round-robin interleave. Cams lead — they're the live-now boards.
  const interleaved: UpcomingSlot[] = []
  const max = Math.max(cams.length, stars.length)
  for (let i = 0; i < max; i++) {
    if (i < cams.length) interleaved.push(cams[i]!)
    if (i < stars.length) interleaved.push(stars[i]!)
  }
  return [...interleaved, ...others]
}
