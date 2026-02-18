'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Bet status types matching backend API response
 */
export type BetStatus =
  | 'pending'
  | 'matched'
  | 'settling'
  | 'settled'

/**
 * Bet record interface matching API response
 */
export interface BetRecord {
  betId: string
  creatorAddress: string
  betHash: string
  portfolioSize: number
  tradeCount?: number         // Epic 8: Actual trade count from bet_trades table
  amount: string
  creatorStake?: string       // Creator's stake amount
  oddsBps?: number            // Odds in basis points
  status: BetStatus
  createdAt: string
  txHash: string
  // Story 14-1: Single-filler model
  fillerAddress?: string      // Address of the filler (if matched)
  fillerStake?: string        // Filler's stake amount
  portfolioJson?: string
  // Epic 8: Category-based betting
  categoryId?: string         // Category ID (e.g., 'crypto', 'predictions')
  listSize?: string           // List size ('1K', '10K', '100K')
  snapshotId?: string         // Snapshot ID for trade list
  // Epic 9: Trade horizon
  horizon?: 'short' | 'daily' | 'weekly' | 'monthly' | 'quarterly'
  // Story 14-1: Early exit support
  earlyExit?: boolean         // True if bet settled via early exit
}

interface UseBetHistoryOptions {
  address: `0x${string}` | undefined
  enabled?: boolean
}

interface UseBetHistoryReturn {
  bets: BetRecord[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Fetches bet history for a specific wallet address
 * Auto-refreshes every 5 seconds
 */
async function fetchBetHistory(address: string): Promise<BetRecord[]> {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/bets/user/${address}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch bet history: ${response.statusText}`)
  }

  const data = await response.json()
  // Map backend tradeCount -> portfolioSize for frontend compatibility
  return (Array.isArray(data) ? data : data.bets || []).map((b: BetRecord & { tradeCount?: number }) => ({
    ...b,
    portfolioSize: b.tradeCount ?? b.portfolioSize ?? 0,
  }))
}

/**
 * Hook for fetching user's bet history
 * @param options - Configuration options including wallet address
 * @returns Bet history data, loading state, and error state
 */
export function useBetHistory({ address, enabled = true }: UseBetHistoryOptions): UseBetHistoryReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['bets', 'user', address],
    queryFn: () => fetchBetHistory(address!),
    enabled: enabled && !!address,
    refetchInterval: 5000,
    staleTime: 3000
  })

  return {
    bets: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}
