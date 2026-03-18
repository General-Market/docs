'use client'

import { useQuery } from '@tanstack/react-query'
import { VISION_API_URL } from '@/lib/config'
import type { AgentRanking, LeaderboardResponse } from '@/hooks/useLeaderboard'

/** Extended Vision leaderboard entry with round-based fields */
export interface VisionLeaderboardEntry extends AgentRanking {
  roundsPlayed: number
  roundsWon: number
  avgCorrectPct: number
}

export interface VisionLeaderboardResponse {
  leaderboard: VisionLeaderboardEntry[]
  updatedAt: string
}

function parseNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  return 0
}

/**
 * Fetches Vision leaderboard from the issuer API.
 * Returns data in the same AgentRanking format as the ITP leaderboard,
 * extended with round-based fields: roundsPlayed, roundsWon, avgCorrectPct.
 */
async function fetchVisionLeaderboard(batchId?: number): Promise<VisionLeaderboardResponse> {
  if (!VISION_API_URL) {
    return { leaderboard: [], updatedAt: new Date().toISOString() }
  }

  const params = batchId !== undefined ? `?batch_id=${batchId}` : ''
  const response = await fetch(`${VISION_API_URL}/vision/leaderboard${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch Vision leaderboard: ${response.status}`)
  }

  const data = await response.json()
  const entries = data.leaderboard ?? []

  const leaderboard: VisionLeaderboardEntry[] = entries.map((e: Record<string, unknown>) => {
    const pnl = parseNum(e.pnl)
    const winRate = parseNum(e.winRate)
    const roi = parseNum(e.roi)
    const totalVolume = parseNum(e.totalVolume)
    const avgPortfolioSize = parseNum(e.avgPortfolioSize)
    const roundsPlayed = parseNum(e.roundsPlayed)
    const roundsWon = parseNum(e.roundsWon)
    const avgCorrectPct = parseNum(e.avgCorrectPct)

    return {
      rank: (e.rank as number) ?? 0,
      walletAddress: (e.walletAddress as string) ?? '',
      pnl,
      winRate,
      roi,
      totalVolume,
      portfolioBets: (e.portfolioBets as number) ?? 0,
      avgPortfolioSize,
      largestPortfolio: (e.largestPortfolio as number) ?? 0,
      // Round-based fields
      roundsPlayed,
      roundsWon,
      avgCorrectPct,
      // Aliases
      volume: totalVolume,
      totalBets: (e.portfolioBets as number) ?? 0,
      maxPortfolioSize: (e.largestPortfolio as number) ?? 0,
    }
  })

  return {
    leaderboard,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

export function useVisionLeaderboard(batchId?: number) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vision-leaderboard', batchId],
    queryFn: () => fetchVisionLeaderboard(batchId),
    refetchInterval: 5000,
    staleTime: 3000,
  })

  return {
    leaderboard: (data?.leaderboard ?? []) as VisionLeaderboardEntry[],
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}
