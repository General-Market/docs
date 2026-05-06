'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useSSEVisionVaults } from '@/hooks/useSSE'

export interface PortfolioPoint {
  /** ISO timestamp at which we sampled the merged P&L. */
  timestamp: string
  /** Sum of (shares × (NAV − 1)) across all held vaults at that timestamp. */
  pnl: number
}

export interface VaultHolding {
  vaultAddress: string
  /** Current shares the user holds. We approximate "you've held this many
   *  shares since vault inception" — the actual deposit timeline isn't yet
   *  on the data-node. Refine when per-user vault history exists. */
  sharesBigInt: bigint
}

interface RawSnapshot {
  ts: number
  nav: number
  tvl: number
}

interface VaultHistoryResponse {
  snapshots: RawSnapshot[]
}

const RANGES = ['1d', '1w', '1m', 'all'] as const
export type PortfolioHistoryRange = (typeof RANGES)[number]

/**
 * Aggregates per-vault NAV history into a single "portfolio P&L over time"
 * series. For each held vault we:
 *   1. Fetch the issuer's bucketed historical snapshots (range-dependent
 *      granularity: 1d → 5min, 1w → 35min, 1m → 3h, all → 6h).
 *   2. Append a live SSE tick at NOW so the curve updates intraday — same
 *      pattern VaultDetailClient uses on /source/.../vault/<addr>.
 *   3. Forward-fill across a union timestamp grid and sum
 *      shares × (NAV − 1) per tick.
 *
 * Cost basis is approximated as inception-NAV — proper deposit-aware
 * accounting requires per-user vault events the data-node doesn't yet
 * surface.
 */
export function useVaultsPortfolioHistory(
  holdings: VaultHolding[],
  range: PortfolioHistoryRange = 'all',
) {
  const enabled = holdings.length > 0
  const sseVaults = useSSEVisionVaults()

  const queries = useQueries({
    queries: holdings.map((h) => ({
      queryKey: ['vault-history', h.vaultAddress.toLowerCase(), range],
      queryFn: async (): Promise<VaultHistoryResponse> => {
        const res = await fetch(
          `/api/vision/vault/${h.vaultAddress}/history?range=${range}`,
        )
        if (!res.ok) return { snapshots: [] }
        return res.json()
      },
      // Aggressively reuse cached series. Each range's response gets its
      // own queryKey, so flipping pills doesn't refetch needlessly.
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      enabled,
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const responses = queries.map((q) => q.data?.snapshots ?? [])

  // Live SSE tick per held vault — converts the streaming nav_per_share to
  // a synthetic snapshot at NOW. Same shape as the historical buckets so
  // the merge code below stays uniform.
  const liveByAddr = useMemo(() => {
    const map = new Map<string, RawSnapshot>()
    if (sseVaults.length === 0) return map
    const now = Date.now()
    for (const v of sseVaults) {
      const key = v.address.toLowerCase()
      if (typeof v.nav_per_share !== 'number') continue
      let tvl = 0
      try {
        tvl = parseFloat(formatUnits(BigInt(v.total_assets ?? '0'), 18))
      } catch {
        // ignore — tvl isn't used for PnL math, only kept for shape parity
      }
      map.set(key, { ts: now, nav: v.nav_per_share, tvl })
    }
    return map
  }, [sseVaults])

  const series = useMemo<PortfolioPoint[]>(() => {
    if (holdings.length === 0) return []

    // Per-vault snapshots = historical buckets + live SSE tip (when newer).
    const perVault = holdings.map((h, i) => {
      const hist = [...responses[i]].sort((a, b) => a.ts - b.ts)
      const live = liveByAddr.get(h.vaultAddress.toLowerCase())
      if (!live) return hist
      if (hist.length === 0) return [live]
      const last = hist[hist.length - 1]
      if (live.ts > last.ts && live.nav !== last.nav) {
        return [...hist, live]
      }
      return hist
    })

    const allTs = new Set<number>()
    for (const snaps of perVault) for (const s of snaps) allTs.add(s.ts)
    if (allTs.size === 0) return []
    const tsSorted = Array.from(allTs).sort((a, b) => a - b)

    const sharesFloat = holdings.map((h) =>
      parseFloat(formatUnits(h.sharesBigInt, 18)),
    )

    const idx = new Array(holdings.length).fill(0)
    const points: PortfolioPoint[] = []
    for (const t of tsSorted) {
      let pnl = 0
      let anyKnown = false
      for (let v = 0; v < holdings.length; v++) {
        const snaps = perVault[v]
        if (snaps.length === 0) continue
        while (idx[v] + 1 < snaps.length && snaps[idx[v] + 1].ts <= t) {
          idx[v]++
        }
        const cur = snaps[idx[v]]
        if (!cur || cur.ts > t) continue
        anyKnown = true
        pnl += sharesFloat[v] * (cur.nav - 1)
      }
      if (anyKnown) {
        points.push({ timestamp: new Date(t).toISOString(), pnl })
      }
    }
    return points
  }, [holdings, responses, liveByAddr])

  return { history: series, isLoading, hasHistory: series.length > 1 }
}
