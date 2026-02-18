'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Agent ranking interface matching backend API response
 */
export interface AgentRanking {
  rank: number
  walletAddress: string       // 0x... format
  pnl: number                 // Decimal, can be negative
  winRate: number             // 0-100 percentage
  roi: number                 // Percentage, can be negative
  totalVolume: number         // USDC amount (renamed from volume to match backend)
  portfolioBets: number       // Count (renamed from totalBets to match backend)
  avgPortfolioSize: number    // Markets count
  largestPortfolio: number    // Markets count (renamed from maxPortfolioSize to match backend)
  lastActiveAt?: string       // ISO timestamp (optional - not always present from backend)
  // Aliases for backward compatibility with frontend components
  volume: number              // Alias for totalVolume
  totalBets: number           // Alias for portfolioBets
  maxPortfolioSize: number    // Alias for largestPortfolio
}

/**
 * Leaderboard response interface
 */
export interface LeaderboardResponse {
  leaderboard: AgentRanking[]
  updatedAt: string // ISO timestamp
}

interface UseLeaderboardReturn {
  leaderboard: AgentRanking[]
  updatedAt: string | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Raw backend response before field mapping
 * Note: Backend returns decimal values as strings for precision
 */
interface BackendAgentRanking {
  rank: number
  walletAddress: string
  pnl: string | number           // Backend returns string
  winRate: string | number       // Backend returns string
  roi: string | number           // Backend returns string
  totalVolume: string | number   // Backend returns string
  portfolioBets: number
  avgPortfolioSize: string | number  // Backend returns string
  largestPortfolio: number
  lastActiveAt?: string  // ISO timestamp from on-chain block timestamp
}

interface BackendLeaderboardResponse {
  leaderboard: BackendAgentRanking[]
  updatedAt: string
}

/**
 * Fetches leaderboard data from backend API
 * Throws error if backend is unavailable - NO MOCK FALLBACKS IN PRODUCTION
 */
async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const backendUrl = getBackendUrl() // Throws if not configured

  const response = await fetch(`${backendUrl}/api/leaderboard`)

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`)
  }

  const data: BackendLeaderboardResponse = await response.json()

  // Transform backend response: parse strings to numbers and add aliases
  // Guard against undefined/null leaderboard array
  const leaderboardArray = data.leaderboard ?? []
  const transformedLeaderboard: AgentRanking[] = leaderboardArray.map((agent) => {
    const pnl = typeof agent.pnl === 'string' ? parseFloat(agent.pnl) : agent.pnl
    const winRate = typeof agent.winRate === 'string' ? parseFloat(agent.winRate) : agent.winRate
    const roi = typeof agent.roi === 'string' ? parseFloat(agent.roi) : agent.roi
    const totalVolume = typeof agent.totalVolume === 'string' ? parseFloat(agent.totalVolume) : agent.totalVolume
    const avgPortfolioSize = typeof agent.avgPortfolioSize === 'string' ? parseFloat(agent.avgPortfolioSize) : agent.avgPortfolioSize

    return {
      rank: agent.rank,
      walletAddress: agent.walletAddress,
      pnl: isNaN(pnl) ? 0 : pnl,
      winRate: isNaN(winRate) ? 0 : winRate,
      roi: isNaN(roi) ? 0 : roi,
      totalVolume: isNaN(totalVolume) ? 0 : totalVolume,
      portfolioBets: agent.portfolioBets,
      avgPortfolioSize: isNaN(avgPortfolioSize) ? 0 : avgPortfolioSize,
      largestPortfolio: agent.largestPortfolio,
      lastActiveAt: agent.lastActiveAt,
      // Add alias fields for backward compatibility
      volume: isNaN(totalVolume) ? 0 : totalVolume,
      totalBets: agent.portfolioBets,
      maxPortfolioSize: agent.largestPortfolio,
    }
  })

  return {
    leaderboard: transformedLeaderboard,
    updatedAt: data.updatedAt,
  }
}

/**
 * Hook for fetching leaderboard data
 * Auto-refreshes every 30 seconds (30000ms)
 * @returns Leaderboard data, loading state, and error state
 */
export function useLeaderboard(): UseLeaderboardReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
    refetchInterval: 5000, // 5 seconds for near real-time updates
    staleTime: 3000 // Consider data stale after 3 seconds
  })

  return {
    leaderboard: data?.leaderboard ?? [],
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}
