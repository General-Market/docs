/**
 * Local bitmap persistence for hit rate computation.
 *
 * After each SUBMIT (bitmap sent to issuers), we store the player's
 * predictions in localStorage. On page load, we cross-reference stored
 * bitmaps against market outcomes from batch history to compute hit rate.
 *
 * Key: `vision-bets-${walletAddress}`
 * Value: JSON array of StoredBet entries (capped at 500 per address)
 */

import type { BatchHistoryEntry } from '@/hooks/p2pool/useBatchHistory'

export interface StoredBet {
  batchId: number
  tickId: number
  /** marketId -> true=UP, false=DOWN */
  bets: Record<string, boolean>
  submittedAt: number
}

export interface HitRateResult {
  /** Number of markets where prediction matched outcome */
  correct: number
  /** Total number of predictions compared */
  total: number
  /** Hit rate as percentage (0-100) */
  hitRate: number
  /** Number of ticks with data */
  ticksAnalyzed: number
}

const MAX_ENTRIES_PER_ADDRESS = 500

function storageKey(address: string): string {
  return `vision-bets-${address.toLowerCase()}`
}

/** Save the player's bets for a specific batch tick to localStorage. */
export function saveBets(
  address: string,
  batchId: number,
  tickId: number,
  bets: Record<string, boolean>,
): void {
  if (typeof window === 'undefined') return

  const key = storageKey(address)
  let entries: StoredBet[] = []

  try {
    const raw = localStorage.getItem(key)
    if (raw) entries = JSON.parse(raw)
  } catch {
    // corrupted data, start fresh
  }

  // Deduplicate: remove existing entry for same batch+tick
  entries = entries.filter(e => !(e.batchId === batchId && e.tickId === tickId))

  entries.push({
    batchId,
    tickId,
    bets,
    submittedAt: Date.now(),
  })

  // Cap size
  if (entries.length > MAX_ENTRIES_PER_ADDRESS) {
    entries = entries.slice(-MAX_ENTRIES_PER_ADDRESS)
  }

  try {
    localStorage.setItem(key, JSON.stringify(entries))
  } catch {
    // storage full — remove oldest half
    entries = entries.slice(Math.floor(entries.length / 2))
    try {
      localStorage.setItem(key, JSON.stringify(entries))
    } catch {
      // give up
    }
  }
}

/** Get all stored bets for a specific batch. */
export function getStoredBets(address: string, batchId: number): StoredBet[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(storageKey(address))
    if (!raw) return []
    const entries: StoredBet[] = JSON.parse(raw)
    return entries.filter(e => e.batchId === batchId)
  } catch {
    return []
  }
}

/**
 * Compute hit rate by comparing stored predictions against market outcomes.
 *
 * For each stored bet entry, finds the matching tick in history,
 * then checks if each market prediction (UP/DOWN) matches `wentUp`.
 */
export function computeHitRate(
  storedBets: StoredBet[],
  history: BatchHistoryEntry[],
): HitRateResult {
  let correct = 0
  let total = 0
  let ticksAnalyzed = 0

  // Build lookup: tickId -> MarketOutcome[]
  const tickMap = new Map<number, Map<string, boolean>>()
  for (const entry of history) {
    const outcomes = new Map<string, boolean>()
    for (const mo of entry.marketOutcomes) {
      outcomes.set(mo.marketId, mo.wentUp)
    }
    tickMap.set(entry.tickId, outcomes)
  }

  for (const stored of storedBets) {
    const outcomes = tickMap.get(stored.tickId)
    if (!outcomes) continue // tick not yet resolved or not in history

    ticksAnalyzed++
    for (const [marketId, predictedUp] of Object.entries(stored.bets)) {
      const actuallyWentUp = outcomes.get(marketId)
      if (actuallyWentUp === undefined) continue // market not in outcomes

      total++
      if (predictedUp === actuallyWentUp) correct++
    }
  }

  return {
    correct,
    total,
    hitRate: total > 0 ? (correct / total) * 100 : 0,
    ticksAnalyzed,
  }
}
