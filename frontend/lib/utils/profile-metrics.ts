import type { PlayerProfile } from '@/hooks/usePlayerProfile'

/**
 * Derived metrics for the profile hero — computed client-side from the
 * PlayerProfile API response so we don't need a new backend route.
 *
 * All figures are in L3 USDC. Tick timestamps in the profile are unix
 * seconds (the oracle's tickId).
 */
export interface ProfileDerivedMetrics {
  /** Dollar value currently committed to open / active batches. */
  positionsValue: number
  /** Largest single positive PnL (tick-level first, falls back to batch). */
  biggestWin: number
  /** Total count of directional bets placed across all batches. */
  predictions: number
  /** Earliest tick timestamp seen for this wallet — the "joined" date. */
  firstSeenUnixSec: number | null
}

export function computeDerivedMetrics(
  profile: PlayerProfile | null,
): ProfileDerivedMetrics {
  if (!profile) {
    return {
      positionsValue: 0,
      biggestWin: 0,
      predictions: 0,
      firstSeenUnixSec: null,
    }
  }

  const batches = profile.batches ?? []

  const positionsValue = batches
    .filter((b) => b.status === 'active')
    .reduce((sum, b) => sum + (b.deposited ?? 0), 0)
    // Fallback: if the indexer isn't flagging anything active yet but the
    // wallet has wagered anything, show the total exposure.
    || batches.reduce((sum, b) => sum + (b.deposited ?? 0), 0)

  let biggestWin = 0
  for (const b of batches) {
    for (const t of b.ticks ?? []) {
      if (t.pnl > biggestWin) biggestWin = t.pnl
    }
    // batch-level ROI on top of deposited gives an absolute win figure too
    const batchPnl = (b.deposited ?? 0) * ((b.roi ?? 0) / 100)
    if (batchPnl > biggestWin) biggestWin = batchPnl
  }

  // "Predictions" in the Polymarket sense = number of directional bets.
  // Each tickCount is the number of ticks the wallet had a pick in; sum
  // across batches gives the total prediction count.
  const predictions = batches.reduce(
    (sum, b) => sum + (b.tickCount ?? 0),
    0,
  ) || profile.stats.totalBatches

  // Earliest tick across all batches — used as the "joined" marker.
  let firstSeen: number | null = null
  for (const b of batches) {
    for (const t of b.ticks ?? []) {
      if (firstSeen === null || t.tickId < firstSeen) {
        firstSeen = t.tickId
      }
    }
  }

  return {
    positionsValue,
    biggestWin,
    predictions,
    firstSeenUnixSec: firstSeen,
  }
}

export function formatJoined(unixSec: number | null): string | null {
  if (!unixSec) return null
  const d = new Date(unixSec * 1000)
  const month = d.toLocaleString('en-US', { month: 'short' })
  return `Joined ${month} ${d.getFullYear()}`
}
