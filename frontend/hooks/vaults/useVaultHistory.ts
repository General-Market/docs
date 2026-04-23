'use client'

import { useQuery } from '@tanstack/react-query'

export interface VaultSnapshot {
  nav: number
  tvl: number
  ts: number
}

export type VaultHistoryRange = '1d' | '1w' | '1m' | 'all'

/**
 * Fetches historical TVL + NAV snapshots for a vault.
 * The oracle windows + buckets rows server-side per range so the chart gets
 * ~200–300 dense points regardless of inception age. Falls back to an empty
 * array if the API isn't available yet.
 */
export function useVaultHistory(vaultAddress: string, range: VaultHistoryRange = 'all') {
  const { data, isLoading } = useQuery<{ snapshots: VaultSnapshot[] }>({
    queryKey: ['vault-history', vaultAddress, range],
    queryFn: async () => {
      const res = await fetch(`/api/vision/vault/${vaultAddress}/history?range=${range}`)
      if (!res.ok) return { snapshots: [] }
      return res.json()
    },
    enabled: !!vaultAddress,
    // Snapshots are written by the fund-manager once per cycle. Refetch every
    // 30s so the chart picks up new points without a reload; keep a short
    // staleTime so cross-component reads don't hammer the API in between.
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  return {
    snapshots: data?.snapshots ?? [],
    isLoading,
    hasHistory: (data?.snapshots?.length ?? 0) > 0,
  }
}
