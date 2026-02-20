'use client'

import { useQuery } from '@tanstack/react-query'

const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL || ''

/**
 * Agent ranking interface matching backend API response
 */
export interface AgentRanking {
  rank: number
  walletAddress: string       // 0x... format
  pnl: number                 // Decimal, can be negative (realized PnL)
  realizedPnl: number         // Explicit realized PnL
  unrealizedPnl: number       // Unrealized PnL (active bets at risk)
  totalPnl: number            // Realized + unrealized
  winRate: number             // 0-100 percentage
  roi: number                 // Percentage, can be negative
  totalVolume: number         // USDC amount (renamed from volume to match backend)
  portfolioBets: number       // Count (renamed from totalBets to match backend)
  avgPortfolioSize: number    // Markets count
  largestPortfolio: number    // Markets count (renamed from maxPortfolioSize to match backend)
  wins: number
  losses: number
  activeBets: number
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
  pnl: string | number
  realizedPnl: string | number
  unrealizedPnl: string | number
  totalPnl: string | number
  winRate: string | number
  roi: string | number
  totalVolume: string | number
  portfolioBets: number
  avgPortfolioSize: string | number
  largestPortfolio: number
  wins: number
  losses: number
  activeBets: number
  lastActiveAt?: string
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
  const response = await fetch(`${VISION_API_URL}/api/leaderboard`)

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`)
  }

  const data: BackendLeaderboardResponse = await response.json()

  // Transform backend response: parse strings to numbers and add aliases
  // Guard against undefined/null leaderboard array
  const leaderboardArray = data.leaderboard ?? []
  const transformedLeaderboard: AgentRanking[] = leaderboardArray.map((agent) => {
    const parse = (v: string | number | undefined) => {
      const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0)
      return isNaN(n) ? 0 : n
    }

    const pnl = parse(agent.pnl)
    const realizedPnl = parse(agent.realizedPnl)
    const unrealizedPnl = parse(agent.unrealizedPnl)
    const totalPnl = parse(agent.totalPnl)
    const winRate = parse(agent.winRate)
    const roi = parse(agent.roi)
    const totalVolume = parse(agent.totalVolume)
    const avgPortfolioSize = parse(agent.avgPortfolioSize)

    return {
      rank: agent.rank,
      walletAddress: agent.walletAddress,
      pnl,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      winRate,
      roi,
      totalVolume,
      portfolioBets: agent.portfolioBets,
      avgPortfolioSize,
      largestPortfolio: agent.largestPortfolio,
      wins: agent.wins ?? 0,
      losses: agent.losses ?? 0,
      activeBets: agent.activeBets ?? 0,
      lastActiveAt: agent.lastActiveAt,
      // Backward compatibility aliases
      volume: totalVolume,
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
