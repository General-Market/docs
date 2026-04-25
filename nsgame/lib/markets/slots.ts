/**
 * Slot generator. Walks each catalog entry forward by its `closeOffsetSecs`
 * stride from `nowSecs`, snaps every close-time to the 60s grid the program
 * enforces, and derives the deterministic Market PDA for each slot. The
 * resulting list is the universe of upcoming windows the UI can offer.
 *
 * The PDA derivation matches `programs-solana/.../place-test-bet.ts`:
 *   seeds = [b"market", source_id_le_u32, close_le_i64, settle_le_i64,
 *            threshold_le_i32]
 */

import { PublicKey } from '@solana/web3.js'
import type { CatalogEntry } from './catalog'

export interface UpcomingSlot {
  catalogId: string
  sourceId: number
  sourceName: string
  label: string
  description: string
  thresholdBps: number
  /** unix seconds, snapped to the 60s grid. */
  closeTime: number
  /** unix seconds. settlementTime = closeTime + (settleOffsetSecs - closeOffsetSecs). */
  settlementTime: number
  /** base58 of the deterministic Market PDA. */
  marketPda: string
}

export interface GenerateSlotsOpts {
  catalog: readonly CatalogEntry[]
  /** Unix seconds. The starting point for slot generation. */
  nowSecs: number
  /** How far ahead to project, in days. Default 7. */
  horizonDays?: number
  /** The on-chain program id, used for PDA derivation. */
  programId: PublicKey
  /**
   * Optional source filter. If set, only slots for this source id are
   * returned. Defaults to no filter ("all").
   */
  source?: number | 'all'
  /**
   * Soft cap on slots-per-catalog-entry to keep the output bounded for
   * short windows (60s × 7d = 10,080 slots). Default 200.
   */
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
    source = 'all',
    maxSlotsPerEntry = DEFAULT_MAX_SLOTS_PER_ENTRY,
  } = opts

  const horizonSecs = nowSecs + horizonDays * 86_400
  const out: UpcomingSlot[] = []

  for (const entry of catalog) {
    if (source !== 'all' && entry.sourceId !== source) continue
    if (entry.closeOffsetSecs <= 0) continue

    // First close: snap up so the program's `closeTime - now >= 10` and
    // 60s-grid invariants both hold.
    const firstClose = snapUpToMinute(nowSecs + entry.closeOffsetSecs)
    const settleDelta = entry.settleOffsetSecs - entry.closeOffsetSecs

    let count = 0
    for (let close = firstClose; close <= horizonSecs; close += entry.closeOffsetSecs) {
      // Belt-and-braces: the program rejects close_time not aligned to 60s.
      if (close % 60 !== 0) continue
      const settle = close + settleDelta
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
        thresholdBps: entry.thresholdBps,
        closeTime: close,
        settlementTime: settle,
        marketPda: pda.toBase58(),
      })
      count++
      if (count >= maxSlotsPerEntry) break
    }
  }

  // Sort by closeTime ascending — the soonest market first.
  out.sort((a, b) => a.closeTime - b.closeTime)
  return out
}
