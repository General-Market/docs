'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Resolution status types for majority-wins system
 * Epic 8: Simplified to pending/resolved/tie/cancelled
 */
export type ResolutionStatus =
  | 'pending'
  | 'resolved'
  | 'tie'
  | 'cancelled'

/**
 * Resolution data interface for majority-wins system
 * Epic 8: Trades won > 50% determines winner
 */
export interface Resolution {
  betId: string
  winsCount: number              // Number of trades the creator won
  validTrades: number            // Total valid trades (excluding cancelled)
  winRate: number                // Percentage 0-100
  creatorWins: boolean | null    // null if tie or cancelled
  isTie: boolean
  isCancelled: boolean
  cancelReason?: string
  resolvedBy?: string            // Keeper address who resolved
  resolvedAt?: string            // ISO timestamp
  totalPot: string               // Total pot in USDC
  platformFee: string            // Platform fee taken
  winnerPayout: string           // Winner's payout amount
  winnerAddress: string | null
  loserAddress: string | null
  settlementTxHash: string | null
  status: ResolutionStatus
}

/**
 * Bet trade with resolution outcome
 */
export interface BetTrade {
  tradeId: string
  ticker: string
  source: string                 // 'coingecko' | 'polymarket' | 'gamma'
  method: string                 // 'price' | 'outcome'
  position: 'LONG' | 'SHORT' | 'YES' | 'NO'
  entryPrice: string
  exitPrice?: string
  won?: boolean
  cancelled?: boolean
}

/**
 * Fetches resolution data for a specific bet
 */
async function fetchResolution(betId: string): Promise<Resolution | null> {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/resolutions/${betId}`)

  if (!response.ok) {
    if (response.status === 404) {
      return null // No resolution data yet
    }
    throw new Error(`Failed to fetch resolution: ${response.statusText}`)
  }

  return response.json()
}

interface UseResolutionOptions {
  betId: string | null
  enabled?: boolean
}

interface UseResolutionReturn {
  resolution: Resolution | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook for fetching resolution data for a bet
 * Auto-refreshes every 30 seconds for live updates
 * @param options - Configuration including betId
 * @returns Resolution data, loading state, and error state
 */
export function useResolution({ betId, enabled = true }: UseResolutionOptions): UseResolutionReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['resolution', betId],
    queryFn: () => fetchResolution(betId!),
    enabled: enabled && !!betId,
    refetchInterval: 30000, // Refetch every 30s for live updates
    staleTime: 10000
  })

  return {
    resolution: data ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}

// ============ Win Rate Formatting Utilities ============

/**
 * Formats win count and total as a percentage string
 * @param wins - Number of trades won
 * @param total - Total valid trades
 * @returns Formatted string like "7/10 (70%)" or "N/A" if no trades
 */
export function formatWinRate(wins: number, total: number): string {
  if (total === 0) return 'N/A'
  const percentage = (wins / total) * 100
  return `${wins}/${total} (${percentage.toFixed(0)}%)`
}

/**
 * Returns Tailwind CSS class for win rate color
 * @param wins - Number of trades won
 * @param total - Total valid trades
 * @returns CSS class based on win rate
 */
export function getWinRateColorClass(wins: number, total: number): string {
  if (total === 0) return 'text-gray-500'
  const rate = wins / total
  if (rate > 0.6) return 'text-green-500'
  if (rate > 0.4) return 'text-yellow-500'
  return 'text-red-500'
}

/**
 * Format resolution outcome for display
 * @param resolution - Resolution data
 * @returns User-friendly outcome string
 */
export function formatResolutionOutcome(resolution: Resolution): string {
  if (resolution.isTie) return 'Tie - Both Refunded'
  if (resolution.isCancelled) return `Cancelled - ${resolution.cancelReason || 'Unknown reason'}`
  if (resolution.creatorWins === true) return 'Creator Wins'
  if (resolution.creatorWins === false) return 'Matcher Wins'
  return 'Pending'
}
