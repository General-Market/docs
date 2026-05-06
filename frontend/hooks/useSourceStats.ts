'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──

export interface SourceStatsRow {
  sourceId: string
  lastSettledAt: string | null
  /** Number of settled rounds (batches) for this source. */
  settledBatches: number
  /**
   * Number of markets settled — SUM(market_count) across settled batches.
   * Matches the topbar's global `totalSettlements` definition. Field is
   * absent on older oracle builds; consumers should fall back to
   * `settledBatches` while the backend rolls out.
   */
  settledMarkets: number
  traderCount: number
  /** Total USDC deposited across all rounds, expressed as 1e18 wei. */
  totalDepositedUsdc: number
}

interface RawRow {
  source_id: string
  last_settled_at: string | null
  settled_batches: number
  settled_markets?: number
  trader_count: number
  total_deposited_wei: string | null
}

interface RawResponse {
  sources: RawRow[]
}

const WEI_PER_USDC = 1e18

function transform(raw: RawRow): SourceStatsRow {
  const wei = raw.total_deposited_wei ? Number(raw.total_deposited_wei) : 0
  return {
    sourceId: raw.source_id,
    lastSettledAt: raw.last_settled_at,
    settledBatches: raw.settled_batches ?? 0,
    settledMarkets: raw.settled_markets ?? 0,
    traderCount: raw.trader_count ?? 0,
    totalDepositedUsdc: Number.isFinite(wei) ? wei / WEI_PER_USDC : 0,
  }
}

const POLL_INTERVAL_MS = 60_000

export function useSourceStats(): {
  byId: Map<string, SourceStatsRow>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
} {
  const [byId, setById] = useState<Map<string, SourceStatsRow>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/vision/explorer/source-stats', {
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: RawResponse = await res.json()
      const next = new Map<string, SourceStatsRow>()
      for (const row of data.sources ?? []) {
        const t = transform(row)
        next.set(t.sourceId.toLowerCase(), t)
      }
      setById(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch source stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { byId, loading, error, refresh }
}
