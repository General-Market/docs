'use client'

import { useQuery } from '@tanstack/react-query'
import { VISION_API_URL } from '@/lib/config'
import type { AgentRanking, LeaderboardResponse } from '@/hooks/useLeaderboard'

/**
 * Fetches Vision leaderboard via the Next.js proxy to the oracle.
 * Returns data in the same AgentRanking format as the ITP leaderboard.
 * Optionally filters by sourceId (all-time) or batchId (single batch).
 */
async function fetchVisionLeaderboard(batchId?: number, sourceId?: string): Promise<LeaderboardResponse> {
  if (!VISION_API_URL) {
    return { leaderboard: [], updatedAt: new Date().toISOString() }
  }

  const searchParams = new URLSearchParams()
  if (sourceId) searchParams.set('source_id', sourceId)
  else if (batchId !== undefined) searchParams.set('batch_id', String(batchId))
  const qs = searchParams.toString()
  const response = await fetch(`${VISION_API_URL}/vision/leaderboard${qs ? `?${qs}` : ''}`)

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

export function useVisionLeaderboard(batchId?: number, sourceId?: string) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vision-leaderboard', sourceId ?? batchId],
    queryFn: () => fetchVisionLeaderboard(batchId, sourceId),
    refetchInterval: 30_000,
    staleTime: 25_000,
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
