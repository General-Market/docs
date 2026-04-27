/**
 * PvP catalog. 25 head-to-head markets — 15 on Stars (4h gain race),
 * 10 on Cams (2m, alternating gain race / viewer total). Each entry
 * carries a `pairIndex` that doubles as the on-chain `threshold_bps`.
 *
 * The on-chain Market PDA is keyed by
 *   (source_id, threshold_bps, close_time, settlement_time)
 * with no asset_id seed. To encode pair identity we route it through
 * threshold_bps. Stars use 1..15, Cams 16..25 — all comfortably under
 * the program's |threshold| <= 10_000 cap.
 *
 * The display `label` reads "<displayA> vs <displayB>" so existing list
 * code that key off a string still works without modification.
 */

import {
  PAIR_REGISTRY,
  type Board,
  type PvpFormat,
  type PvpPair,
  formatDescription,
  formatHook,
} from './pairs'

export interface CatalogEntry {
  /** Stable identifier; must not change between deploys. */
  id: string
  /** Admin-registered Source.source_id on-chain. */
  sourceId: number
  /** Display label for the source. Cosmetic. */
  sourceName: string
  /** PvP pair index (1..25). On-chain this is the threshold_bps. */
  pairIndex: number
  /** Carried for slot/PDA derivation; numerically equal to pairIndex. */
  thresholdBps: number
  /** Seconds from now until the Market stops accepting bets. */
  closeOffsetSecs: number
  /** Seconds from now until the Market becomes resolvable. */
  settleOffsetSecs: number
  /** "<displayA> vs <displayB>" — used by every list/sidebar that reads label. */
  label: string
  /** Long-form prose. The bet sheet renders it under the title. */
  description: string
  /** Single-line hook rendered under the title on the market card. */
  hook: string
  // PvP-specific cosmetics, lifted to the catalog so consumers don't
  // need a second lookup against the pair registry.
  board: Board
  format: PvpFormat
  displayA: string
  displayB: string
  slugA: string
  slugB: string
  audienceA: bigint
  audienceB: bigint
  tightness: number
  windowSecs: number
}

const SOURCE_LABELS: Record<number, string> = {
  1: 'tubes_xv',
  4: 'tubes_cb',
}

// Stars: cohort cycle is 1 h, bet window is the full cycle, race
// phase lasts another 3 h after close. Settle = close + 3 h. Multiple
// cohorts overlap at any instant (one bettable, three racing) — the
// pair never goes dormant.
// Cams: settle 60 s past close — short cushion for collector lag.
// All offsets must be multiples of 60 (program enforces
// `settlement_time % 60 == 0`).
const STARS_SETTLE_DELAY_SECS = 10_800 // 3 h race after close
const CAMS_SETTLE_DELAY_SECS = 60

function entryFromPair(pair: PvpPair): CatalogEntry {
  const sourceName = SOURCE_LABELS[pair.sourceId] ?? `source_${pair.sourceId}`
  const closeOffsetSecs = pair.betWindowSecs
  const settleDelay = pair.board === 'stars'
    ? STARS_SETTLE_DELAY_SECS
    : CAMS_SETTLE_DELAY_SECS
  const settleOffsetSecs = closeOffsetSecs + settleDelay
  const id = `${sourceName}_pvp_${pair.format === 'f1-gain-race' ? 'f1' : 'f2'}_${pair.slugA}__vs__${pair.slugB}`
  const label = `${pair.displayA} vs ${pair.displayB}`
  const description = formatDescription(pair)
  const hook = formatHook(pair)

  return {
    id,
    sourceId: pair.sourceId,
    sourceName,
    pairIndex: pair.pairIndex,
    thresholdBps: pair.pairIndex,
    closeOffsetSecs,
    settleOffsetSecs,
    label,
    description,
    hook,
    board: pair.board,
    format: pair.format,
    displayA: pair.displayA,
    displayB: pair.displayB,
    slugA: pair.slugA,
    slugB: pair.slugB,
    audienceA: pair.audienceA,
    audienceB: pair.audienceB,
    tightness: pair.tightness,
    windowSecs: pair.windowSecs,
  }
}

export const CATALOG: readonly CatalogEntry[] = PAIR_REGISTRY.map(entryFromPair)

export function getCatalogEntry(id: string): CatalogEntry | null {
  return CATALOG.find(e => e.id === id) ?? null
}

export function getCatalogEntryByPairIndex(pairIndex: number): CatalogEntry | null {
  return CATALOG.find(e => e.pairIndex === pairIndex) ?? null
}

export const SOURCE_LABELS_BY_ID = SOURCE_LABELS
