'use client'

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LeaderboardResponse, AgentRanking } from '@/hooks/useLeaderboard'
import { useSSEConnection, SSEEventListener, SSEConnectionState } from '@/hooks/useSSEConnection'

// Re-export SSEState so existing consumers don't break
export type SSEState = SSEConnectionState

/**
 * Rank change event data from SSE
 */
export interface RankChangeEvent {
  address: string
  oldRank: number
  newRank: number
}

/**
 * Return type for useLeaderboardSSE hook
 */
export interface UseLeaderboardSSEReturn {
  state: SSEState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
  isPolling: boolean
}

/**
 * Transform raw backend data to properly typed LeaderboardResponse
 * Backend returns decimal values as strings for precision
 */
function transformLeaderboardData(rawData: unknown): LeaderboardResponse {
  const data = rawData as {
    leaderboard?: Array<{
      rank: number
      walletAddress: string
      pnl: string | number
      winRate: string | number
      roi: string | number
      totalVolume: string | number
      portfolioBets: number
      avgPortfolioSize: string | number
      largestPortfolio: number
      lastActiveAt?: string
    }>
    updatedAt?: string
  }

  if (!data.leaderboard) {
    return { leaderboard: [], updatedAt: data.updatedAt || new Date().toISOString() }
  }

  const transformedLeaderboard: AgentRanking[] = data.leaderboard.map((agent) => {
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
      volume: isNaN(totalVolume) ? 0 : totalVolume,
      totalBets: agent.portfolioBets,
      maxPortfolioSize: agent.largestPortfolio,
    }
  })

  return {
    leaderboard: transformedLeaderboard,
    updatedAt: data.updatedAt || new Date().toISOString(),
  }
}

/**
 * SSE hook for leaderboard live updates.
 * Connects to /api/leaderboard/live — updates TanStack Query cache on events.
 * Falls back to polling after 3 failed reconnection attempts.
 */
export function useLeaderboardSSE(): UseLeaderboardSSEReturn {
  const queryClient = useQueryClient()

  const onMessage = useCallback((event: MessageEvent) => {
    try {
      const rawData = JSON.parse(event.data)
      const data = transformLeaderboardData(rawData)
      queryClient.setQueryData(['leaderboard'], data)
    } catch (e) {
      console.error('[useLeaderboardSSE] failed to parse SSE message:', e)
    }
  }, [queryClient])

  const listeners: SSEEventListener[] = useMemo(() => [
    {
      type: 'leaderboard-update',
      handler: (event: MessageEvent) => {
        try {
          const rawData = JSON.parse(event.data)
          const data = transformLeaderboardData(rawData)
          queryClient.setQueryData(['leaderboard'], data)
        } catch (e) {
          console.error('[useLeaderboardSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'rank-change',
      handler: (event: MessageEvent) => {
        try {
          const data: RankChangeEvent = JSON.parse(event.data)
          window.dispatchEvent(
            new CustomEvent('leaderboard-rank-change', { detail: data })
          )
        } catch (e) {
          console.error('[useLeaderboardSSE] malformed SSE event:', e)
        }
      },
    },
  ], [queryClient])

  const pollingConfig = useMemo(() => ({
    fetchFn: async (backendUrl: string) => {
      try {
        const response = await fetch(`${backendUrl}/api/leaderboard`)
        if (response.ok) {
          const rawData = await response.json()
          const data = transformLeaderboardData(rawData)
          queryClient.setQueryData(['leaderboard'], data)
        }
      } catch (e) {
        console.error('[useLeaderboardSSE] polling fetch failed:', e)
      }
    },
    interval: 30000,
  }), [queryClient])

  return useSSEConnection({
    path: '/api/leaderboard/live',
    listeners,
    onMessage,
    maxReconnectAttempts: 3,
    polling: pollingConfig,
    handleVisibility: true,
    debugLabel: 'useLeaderboardSSE',
  })
}
