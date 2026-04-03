'use client'

import { useQuery } from '@tanstack/react-query'

export interface VaultSnapshot {
  nav: number
  tvl: number
  ts: number
}

/**
 * Fetches historical TVL + NAV snapshots for a vault.
 * Falls back to empty array if the API isn't available yet.
 */
export function useVaultHistory(vaultAddress: string) {
  const { data, isLoading } = useQuery<{ snapshots: VaultSnapshot[] }>({
    queryKey: ['vault-history', vaultAddress],
    queryFn: async () => {
      const res = await fetch(`/api/vision/vault/${vaultAddress}/history`)
      if (!res.ok) return { snapshots: [] }
      return res.json()
    },
    enabled: !!vaultAddress,
    staleTime: 60_000,
  })

  return {
    snapshots: data?.snapshots ?? [],
    isLoading,
    hasHistory: (data?.snapshots?.length ?? 0) > 0,
  }
}
