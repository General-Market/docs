'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Agent bet interface for recent bets table (AC5)
 */
export interface AgentBet {
  betId: string
  portfolioSize: number    // Number of markets in portfolio
  tradeCount?: number      // Epic 8: Actual trade count from bet_trades table
  amount: number           // USDC wagered
  result: number           // P&L (positive or negative)
  status: 'pending' | 'matched' | 'settled'
  outcome?: 'won' | 'lost' // Only if settled
  createdAt: string        // ISO timestamp
}

/**
 * Agent bets response interface
 */
export interface AgentBetsResponse {
  bets: AgentBet[]
  total: number
}

interface UseAgentBetsReturn {
  bets: AgentBet[]
  total: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Fetches agent bets from backend API
 * Throws error if backend is unavailable - NO MOCK FALLBACKS IN PRODUCTION
 */
async function fetchAgentBets(walletAddress: string, limit: number = 10): Promise<AgentBetsResponse> {
  const backendUrl = getBackendUrl() // Throws if not configured

  const response = await fetch(`${backendUrl}/api/agents/${walletAddress}/bets?limit=${limit}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch agent bets: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  // Map backend tradeCount -> portfolioSize for frontend compatibility
  if (data.bets) {
    data.bets = data.bets.map((b: AgentBet & { tradeCount?: number }) => ({
      ...b,
      portfolioSize: b.tradeCount ?? b.portfolioSize ?? 0,
    }))
  }
  return data
}

/**
 * Hook for fetching agent's recent bets
 * Used on agent detail page for bets table (AC5)
 *
 * @param walletAddress - The wallet address of the agent
 * @param limit - Number of bets to fetch (default 10)
 * @returns Agent bets data, loading state, and error state
 */
export function useAgentBets(walletAddress: string, limit: number = 10): UseAgentBetsReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['agent-bets', walletAddress, limit],
    queryFn: () => fetchAgentBets(walletAddress, limit),
    enabled: !!walletAddress,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchInterval: 60000 // Refetch every minute
  })

  return {
    bets: data?.bets ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}
