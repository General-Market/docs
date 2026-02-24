'use client'

import { useQuery } from '@tanstack/react-query'
import { VISION_API_URL } from '@/lib/config'
import type { AgentRanking, LeaderboardResponse } from '@/hooks/useLeaderboard'

/**
 * Fetches Vision leaderboard from the issuer API.
 * Returns data in the same AgentRanking format as the ITP leaderboard.
 */
async function fetchVisionLeaderboard(): Promise<LeaderboardResponse> {
  if (!VISION_API_URL) {
    return { leaderboard: [], updatedAt: new Date().toISOString() }
  }

  const response = await fetch(`${VISION_API_URL}/vision/leaderboard`)

  if (!response.ok) {
    throw new Error(`Failed to fetch Vision leaderboard: ${response.status}`)
  }

  const data = await response.json()
  const entries = data.leaderboard ?? []

  const leaderboard: AgentRanking[] = entries.map((e: Record<string, unknown>) => {
    const pnl = typeof e.pnl === 'string' ? parseFloat(e.pnl as string) : (e.pnl as number) ?? 0
    const winRate = typeof e.winRate === 'string' ? parseFloat(e.winRate as string) : (e.winRate as number) ?? 0
    const roi = typeof e.roi === 'string' ? parseFloat(e.roi as string) : (e.roi as number) ?? 0
    const totalVolume = typeof e.totalVolume === 'string' ? parseFloat(e.totalVolume as string) : (e.totalVolume as number) ?? 0
    const avgPortfolioSize = typeof e.avgPortfolioSize === 'string' ? parseFloat(e.avgPortfolioSize as string) : (e.avgPortfolioSize as number) ?? 0

    return {
      rank: (e.rank as number) ?? 0,
      walletAddress: (e.walletAddress as string) ?? '',
      pnl: isNaN(pnl) ? 0 : pnl,
      winRate: isNaN(winRate) ? 0 : winRate,
      roi: isNaN(roi) ? 0 : roi,
      totalVolume: isNaN(totalVolume) ? 0 : totalVolume,
      portfolioBets: (e.portfolioBets as number) ?? 0,
      avgPortfolioSize: isNaN(avgPortfolioSize) ? 0 : avgPortfolioSize,
      largestPortfolio: (e.largestPortfolio as number) ?? 0,
      // Aliases
      volume: isNaN(totalVolume) ? 0 : totalVolume,
      totalBets: (e.portfolioBets as number) ?? 0,
      maxPortfolioSize: (e.largestPortfolio as number) ?? 0,
    }
  })

  return {
    leaderboard,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

export function useVisionLeaderboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vision-leaderboard'],
    queryFn: fetchVisionLeaderboard,
    refetchInterval: 5000,
    staleTime: 3000,
  })

  return {
    leaderboard: data?.leaderboard ?? [],
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}
