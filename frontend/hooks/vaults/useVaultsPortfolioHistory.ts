'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { formatUnits } from 'viem'

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
 * series. For each held vault we treat current shares as constant — exact
 * cost basis would require per-user deposit/withdraw events, which the
 * data-node doesn't surface today. The shape of the curve is honest;
 * absolute level is a charitable estimate.
 */
export function useVaultsPortfolioHistory(
  holdings: VaultHolding[],
  range: PortfolioHistoryRange = 'all',
) {
  const enabled = holdings.length > 0
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
      staleTime: 30_000,
      enabled,
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const responses = queries.map((q) => q.data?.snapshots ?? [])

  const series = useMemo<PortfolioPoint[]>(() => {
    if (holdings.length === 0) return []

    // Collect every snapshot timestamp across all vaults — gives a dense
    // union grid. For each grid timestamp, we look up each vault's
    // most-recent NAV at-or-before that ts (forward-fill).
    const allTs = new Set<number>()
    for (const snaps of responses) {
      for (const s of snaps) allTs.add(s.ts)
    }
    if (allTs.size === 0) return []
    const tsSorted = Array.from(allTs).sort((a, b) => a - b)

    // Pre-sort each vault's snapshots ascending by ts.
    const perVault = responses.map((snaps) =>
      [...snaps].sort((a, b) => a.ts - b.ts),
    )

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
        // Advance pointer while next snapshot is still ≤ t.
        while (idx[v] + 1 < snaps.length && snaps[idx[v] + 1].ts <= t) {
          idx[v]++
        }
        const cur = snaps[idx[v]]
        if (!cur || cur.ts > t) continue
        anyKnown = true
        const nav = cur.nav
        // shares × (NAV − 1) → PnL in collateral terms.
        pnl += sharesFloat[v] * (nav - 1)
      }
      if (anyKnown) {
        // `ts` from the issuer API is millisecond-precision (matches what
        // VaultActions.computePerfForPeriod assumes when subtracting from
        // Date.now()).
        points.push({ timestamp: new Date(t).toISOString(), pnl })
      }
    }
    return points
  }, [holdings, responses])

  return { history: series, isLoading, hasHistory: series.length > 1 }
}
