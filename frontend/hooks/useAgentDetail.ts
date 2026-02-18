'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Bet summary interface for best/worst bet tracking
 */
export interface BetSummary {
  betId: number
  amount: number
  result: number
  portfolioSize: number
}

/**
 * Extended agent detail interface with all stats for detail page
 * Works for ANY address with bet activity (no registration required)
 */
export interface AgentDetail {
  // Core identification
  rank: number
  walletAddress: string       // 0x... format
  displayName?: string        // Optional ENS or custom name

  // Performance metrics
  pnl: number                 // Decimal, can be negative
  winRate: number             // 0-100 percentage
  roi: number                 // Percentage, can be negative
  volume: number              // USDC amount
  totalBets: number           // Count
  avgPortfolioSize: number    // Markets count
  maxPortfolioSize: number    // Markets count
  lastActiveAt: string        // ISO timestamp

  // Extended stats for detail page
  minPortfolioSize: number       // Smallest portfolio (markets)
  totalMarketsAnalyzed: number   // Sum of all portfolio sizes
  avgBetSize: number             // volume / totalBets
  bestBet: BetSummary            // Highest P&L bet
  worstBet: BetSummary           // Lowest P&L bet
}

interface UseAgentDetailReturn {
  agent: AgentDetail | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Fetches agent detail data from backend API
 * Throws error if backend is unavailable - NO MOCK FALLBACKS IN PRODUCTION
 */
async function fetchAgentDetail(walletAddress: string): Promise<AgentDetail> {
  const backendUrl = getBackendUrl() // Throws if not configured

  const response = await fetch(`${backendUrl}/api/agents/${walletAddress}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch agent detail: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Hook for fetching detailed agent data
 * Used on agent detail page for extended stats (AC2, AC3)
 *
 * @param walletAddress - The wallet address of the agent
 * @returns Agent detail data, loading state, and error state
 */
export function useAgentDetail(walletAddress: string): UseAgentDetailReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['agent-detail', walletAddress],
    queryFn: () => fetchAgentDetail(walletAddress),
    enabled: !!walletAddress,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchInterval: 60000 // Refetch every minute
  })

  return {
    agent: data ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}
