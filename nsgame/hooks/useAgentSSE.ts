'use client'

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RecentBetEvent, RecentBetsResponse } from '@/hooks/useRecentBets'
import type { BetPlacedEvent, BetMatchedEvent, BetSettledEvent, BetEarlyExitEvent } from '@/hooks/useBetsSSE'
import { useSSEConnection, SSEConnectionState, SSEEventListener } from '@/hooks/useSSEConnection'

export type AgentSSEState = SSEConnectionState

export interface UseAgentSSEReturn {
  state: AgentSSEState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
  isPolling: boolean
}

function transformBetPlacedEvent(data: BetPlacedEvent): RecentBetEvent {
  return {
    betId: data.betId,
    walletAddress: data.creator,
    eventType: 'placed',
    portfolioSize: data.tradeCount ?? data.portfolioSize ?? 0,
    amount: data.amount,
    result: null,
    timestamp: data.timestamp
  }
}

function transformBetMatchedEvent(data: BetMatchedEvent): RecentBetEvent {
  return {
    betId: data.betId,
    walletAddress: data.matcher,
    eventType: 'matched',
    portfolioSize: 0,
    amount: data.amount,
    result: null,
    timestamp: data.timestamp
  }
}

function transformBetSettledEvent(data: BetSettledEvent): RecentBetEvent {
  const pnl = parseFloat(data.pnl)
  const eventType = pnl >= 0 ? 'won' : 'lost'
  return {
    betId: data.betId,
    walletAddress: data.winner,
    eventType,
    portfolioSize: data.tradeCount ?? data.portfolioSize ?? 0,
    amount: '0',
    result: data.pnl,
    timestamp: data.timestamp
  }
}

function transformBetEarlyExitEvent(data: BetEarlyExitEvent): RecentBetEvent {
  return {
    betId: data.betId,
    walletAddress: data.creator,
    eventType: 'settled',
    portfolioSize: 0,
    amount: '0',
    result: null,
    timestamp: data.timestamp
  }
}

/**
 * SSE hook for agent-specific bet feed.
 * Connects to /api/sse/agent/{address} — updates TanStack Query cache on events.
 * Falls back to polling after 3 failed reconnection attempts.
 * Pauses SSE when tab is hidden, resumes when visible.
 */
export function useAgentSSE(walletAddress: string, limit: number = 10): UseAgentSSEReturn {
  const queryClient = useQueryClient()

  const updateQueryCache = useCallback((newEvent: RecentBetEvent) => {
    queryClient.setQueryData<RecentBetsResponse>(['agent-bets', walletAddress, limit], (oldData) => {
      if (!oldData) return { events: [newEvent] }
      const updatedEvents = [newEvent, ...(oldData.events ?? [])].slice(0, limit)
      return { events: updatedEvents }
    })
  }, [queryClient, walletAddress, limit])

  const emitNewBetEvent = useCallback((betId: string, portfolioSize: number) => {
    window.dispatchEvent(
      new CustomEvent('agent-bet-new', {
        detail: { betId, portfolioSize, walletAddress }
      })
    )
  }, [walletAddress])

  const listeners: SSEEventListener[] = useMemo(() => [
    {
      type: 'bet-placed',
      handler: (event: MessageEvent) => {
        try {
          const data: BetPlacedEvent = JSON.parse(event.data)
          updateQueryCache(transformBetPlacedEvent(data))
          emitNewBetEvent(data.betId, data.portfolioSize)
        } catch (e) {
          console.error('[useAgentSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'bet-matched',
      handler: (event: MessageEvent) => {
        try {
          const data: BetMatchedEvent = JSON.parse(event.data)
          updateQueryCache(transformBetMatchedEvent(data))
          emitNewBetEvent(data.betId, 0)
        } catch (e) {
          console.error('[useAgentSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'bet-settled',
      handler: (event: MessageEvent) => {
        try {
          const data: BetSettledEvent = JSON.parse(event.data)
          updateQueryCache(transformBetSettledEvent(data))
          emitNewBetEvent(data.betId, data.portfolioSize)
        } catch (e) {
          console.error('[useAgentSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'bet-early-exit',
      handler: (event: MessageEvent) => {
        try {
          const data: BetEarlyExitEvent = JSON.parse(event.data)
          updateQueryCache(transformBetEarlyExitEvent(data))
          emitNewBetEvent(data.betId, 0)
        } catch (e) {
          console.error('[useAgentSSE] malformed SSE event:', e)
        }
      },
    },
  ], [updateQueryCache, emitNewBetEvent])

  const pollingConfig = useMemo(() => ({
    fetchFn: async (backendUrl: string) => {
      try {
        const response = await fetch(`${backendUrl}/api/agents/${walletAddress}/bets?limit=${limit}`)
        if (response.ok) {
          const data: RecentBetsResponse = await response.json()
          queryClient.setQueryData(['agent-bets', walletAddress, limit], data)
        }
      } catch (e) {
        console.error('[useAgentSSE] polling fetch failed:', e)
      }
    },
    interval: 30000,
  }), [queryClient, walletAddress, limit])

  return useSSEConnection({
    path: `/api/sse/agent/${walletAddress}`,
    listeners,
    maxReconnectAttempts: 3,
    polling: pollingConfig,
    handleVisibility: true,
    enabled: !!walletAddress,
    debugLabel: 'useAgentSSE',
  })
}
