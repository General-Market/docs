'use client'

import { useQuery } from '@tanstack/react-query'

export interface AccountPnlPoint {
  ts: number
  value: number
  cost: number
  pnl: number
  realized_pnl: number
}

export interface AccountPnlHistory {
  range: string
  bucket_secs: number
  points: AccountPnlPoint[]
  last_updated: string | null
}

const RANGES = ['1d', '1w', '1m', 'all'] as const
export type AccountPnlRange = (typeof RANGES)[number]

/**
 * Fetches the precomputed per-account portfolio PnL curve from the
 * `account_pnl_curve` materialized view via `/api/account/:addr/pnl-history`.
 * Replaces the old useVaultsPortfolioHistory which fanned out N requests
 * per profile load and assumed cost basis = current shares × $1.
 */
export function useAccountPnlHistory(
  address: string | undefined,
  range: AccountPnlRange = 'all',
) {
  const enabled = !!address
  const q = useQuery<AccountPnlHistory>({
    queryKey: ['account-pnl-history', address?.toLowerCase(), range],
    queryFn: async () => {
      const res = await fetch(`/api/account/${address}/pnl-history?range=${range}`)
      if (!res.ok) {
        return { range, bucket_secs: 21600, points: [], last_updated: null }
      }
      return res.json()
    },
    staleTime: 30_000,
    enabled,
  })

  return {
    history: q.data?.points ?? [],
    isLoading: q.isLoading,
    hasHistory: (q.data?.points.length ?? 0) > 1,
    lastUpdated: q.data?.last_updated ?? null,
  }
}
