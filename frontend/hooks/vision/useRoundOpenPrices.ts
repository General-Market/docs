'use client'

import { useRef } from 'react'
import type { HistoryPoint } from '@/hooks/vision/useBulkMarketHistory'

interface MarketLike {
  assetId: string
  value: string
}

/**
 * One frozen open price per market, per round, shared by every chart on the page.
 *
 * The open is the price at the instant the round opened. We recover it once and
 * hold it for the life of the round, so the value never flickers and the big
 * candle chart and the mini-cards always read the same number:
 *
 *   - history-first — the first sample at or after `roundOpenAt`. Accurate on a
 *     cold load, where the open moment is already minutes in the past and the
 *     loaded history covers it.
 *   - live bridge — the current snapshot value, used only once history is loaded
 *     but has no sample inside the new round window yet (the round just advanced
 *     and no tick has landed). At that instant the live value *is* the open.
 *     While history is still loading we set nothing, so a cold load never freezes
 *     the current price as a mid-round open.
 *
 * Once set for a given `roundOpenAt` the value is frozen; a later history sample
 * never overwrites it. That is what keeps the open line from jumping a tick into
 * the round, and what stops the two charts from ever disagreeing.
 */
export function useRoundOpenPrices(
  roundOpenAt: number | null,
  markets: MarketLike[],
  historyByAsset: Map<string, HistoryPoint[]> | undefined,
): Map<string, number> {
  const frozen = useRef<{ roundOpenAt: number | null; opens: Map<string, number> }>({
    roundOpenAt: null,
    opens: new Map(),
  })

  // A new round invalidates every frozen open — start recovering fresh.
  if (frozen.current.roundOpenAt !== roundOpenAt) {
    frozen.current = { roundOpenAt, opens: new Map() }
  }
  const { opens } = frozen.current

  if (roundOpenAt != null) {
    for (const m of markets) {
      if (opens.has(m.assetId)) continue // already frozen for this round
      const sample = historyByAsset?.get(m.assetId)?.find(p => p.ts >= roundOpenAt)
      if (sample) {
        opens.set(m.assetId, sample.value)
      } else if (historyByAsset !== undefined) {
        const live = parseFloat(m.value)
        if (isFinite(live)) opens.set(m.assetId, live)
      }
    }
  }

  return opens
}
