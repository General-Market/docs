/**
 * Hardcoded catalog of markets the frontend offers. Each entry defines
 * (source, threshold, close offset, settlement offset). At click time the
 * frontend resolves these offsets against wall-clock `now` to produce the
 * concrete `close_time` and `settlement_time` that seed the Market PDA.
 *
 * Two users picking the same catalog entry at similar moments will likely
 * land on the same `close_time` (they both see roughly the same `now`),
 * and therefore the same Market PDA — joining the same pool.
 *
 * Bounds enforced by the program (mirrored here for UI validation):
 *   threshold_bps != 0, |threshold_bps| <= 10_000
 *   close_time - now >= 10
 *   settlement_time - close_time >= 10
 *   settlement_time - now <= 30 days
 */

export interface CatalogEntry {
  /** Opaque handle for the frontend; stable across deployments. */
  id: string
  /** Admin-registered Source.source_id on chain. */
  sourceId: number
  /** Human-readable label for the Source. Cosmetic only. */
  sourceName: string
  /** Signed bps threshold — positive = YES on rise, negative = YES on drop. */
  thresholdBps: number
  /** Seconds from click-time until the Market stops accepting bets. */
  closeOffsetSecs: number
  /** Seconds from click-time until the Market becomes resolvable. */
  settleOffsetSecs: number
  /** Catalog-card label. */
  label: string
  /** One-liner describing what YES means. */
  description: string
}

// 6 entries: BTC / ETH / SOL at +0.5%, -0.5%, +1% with varying durations.
// Source IDs are placeholders — admin must `upsert_source` on-chain with
// these ids before the markets can be opened. Wire this map up to the
// real deployment when the program lands.
export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'btc-up-050-5m',
    sourceId: 1,
    sourceName: 'BTC/USD',
    thresholdBps: 50,
    closeOffsetSecs: 150,
    settleOffsetSecs: 300,
    label: 'BTC +0.5% in 5m',
    description: 'YES pays if BTC settles at or above baseline +0.5%.',
  },
  {
    id: 'btc-down-050-5m',
    sourceId: 1,
    sourceName: 'BTC/USD',
    thresholdBps: -50,
    closeOffsetSecs: 150,
    settleOffsetSecs: 300,
    label: 'BTC −0.5% in 5m',
    description: 'YES pays if BTC settles at or below baseline −0.5%.',
  },
  {
    id: 'btc-up-100-15m',
    sourceId: 1,
    sourceName: 'BTC/USD',
    thresholdBps: 100,
    closeOffsetSecs: 300,
    settleOffsetSecs: 900,
    label: 'BTC +1.0% in 15m',
    description: 'YES pays if BTC settles at or above baseline +1.0%.',
  },
  {
    id: 'eth-up-050-5m',
    sourceId: 2,
    sourceName: 'ETH/USD',
    thresholdBps: 50,
    closeOffsetSecs: 150,
    settleOffsetSecs: 300,
    label: 'ETH +0.5% in 5m',
    description: 'YES pays if ETH settles at or above baseline +0.5%.',
  },
  {
    id: 'eth-down-050-10m',
    sourceId: 2,
    sourceName: 'ETH/USD',
    thresholdBps: -50,
    closeOffsetSecs: 300,
    settleOffsetSecs: 600,
    label: 'ETH −0.5% in 10m',
    description: 'YES pays if ETH settles at or below baseline −0.5%.',
  },
  {
    id: 'sol-up-100-10m',
    sourceId: 3,
    sourceName: 'SOL/USD',
    thresholdBps: 100,
    closeOffsetSecs: 300,
    settleOffsetSecs: 600,
    label: 'SOL +1.0% in 10m',
    description: 'YES pays if SOL settles at or above baseline +1.0%.',
  },
] as const

export function getCatalogEntry(id: string): CatalogEntry | null {
  return CATALOG.find(e => e.id === id) ?? null
}

/**
 * Resolves a catalog entry to concrete timestamps using the provided
 * `nowSecs` (unix seconds). Rounds to the nearest whole second.
 */
export function resolveWindow(
  entry: CatalogEntry,
  nowSecs: number,
): { closeTime: bigint; settlementTime: bigint } {
  const now = Math.floor(nowSecs)
  return {
    closeTime: BigInt(now + entry.closeOffsetSecs),
    settlementTime: BigInt(now + entry.settleOffsetSecs),
  }
}
