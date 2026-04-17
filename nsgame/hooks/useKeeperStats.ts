'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Keeper statistics interface matching backend API response
 */
export interface KeeperStats {
  keeperAddress: string
  totalVotes: number
  votesInConsensus: number
  accuracyRate: number              // 0.0 to 1.0
  avgScoreDeviation: number
  totalBetsVoted: number
  lastVotedAt: string
}

/**
 * Fetches keeper statistics
 */
async function fetchKeeperStats(address: string): Promise<KeeperStats | null> {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/keepers/${address}/stats`)

  if (!response.ok) {
    if (response.status === 404) {
      return null // Keeper not found
    }
    throw new Error(`Failed to fetch keeper stats: ${response.statusText}`)
  }

  return response.json()
}

interface UseKeeperStatsOptions {
  address: string | null
  enabled?: boolean
}

interface UseKeeperStatsReturn {
  stats: KeeperStats | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook for fetching keeper statistics
 * @param options - Configuration including keeper address
 * @returns Keeper stats, loading state, and error state
 */
export function useKeeperStats({ address, enabled = true }: UseKeeperStatsOptions): UseKeeperStatsReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['keeper', 'stats', address],
    queryFn: () => fetchKeeperStats(address!),
    enabled: enabled && !!address,
    staleTime: 60000 // Cache for 1 minute - keeper stats don't change frequently
  })

  return {
    stats: data ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}

/**
 * Format accuracy rate as percentage
 * @param rate - Decimal rate (0.0 to 1.0)
 * @returns Formatted string like "95.2%"
 */
export function formatAccuracyRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}
