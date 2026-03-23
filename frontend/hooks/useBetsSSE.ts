'use client'

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RecentBetEvent, RecentBetsResponse } from '@/hooks/useRecentBets'
import { updateSignatureStatusFromEvent } from '@/hooks/useResolutionSignatures'
import type { SignatureCollectedEvent, ResolutionSubmittedEvent } from '@/lib/types/resolution'
import { useSSEConnection, SSEConnectionState, SSEEventListener } from '@/hooks/useSSEConnection'

export type BetSSEState = SSEConnectionState

/**
 * SSE event types from backend (Story 6-1)
 */
export interface BetPlacedEvent {
  type: 'BetPlaced'
  betId: string
  creator: string
  portfolioSize: number
  tradeCount?: number
  amount: string
  timestamp: string
}

export interface BetMatchedEvent {
  type: 'BetMatched'
  betId: string
  matcher: string
  amount: string
  timestamp: string
}

export interface BetSettledEvent {
  type: 'BetSettled'
  betId: string
  winner: string
  pnl: string
  portfolioSize: number
  tradeCount?: number
  timestamp: string
}

export interface BetEarlyExitEvent {
  type: 'BetEarlyExit'
  betId: string
  creator: string
  filler: string
  creatorAmount: string
  fillerAmount: string
  timestamp: string
}

export interface UseBetsSSEReturn {
  state: BetSSEState
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
 * SSE hook for the global bet feed.
 * Connects to /api/sse/bets — updates TanStack Query cache on events.
 * Handles: bet-placed, bet-matched, bet-settled, bet-early-exit,
 * signature-collected, resolution-submitted.
 * Falls back to polling after 3 failed reconnection attempts.
 */
export function useBetsSSE(): UseBetsSSEReturn {
  const queryClient = useQueryClient()

  const updateQueryCache = useCallback((newEvent: RecentBetEvent) => {
    queryClient.setQueryData<RecentBetsResponse>(['recent-bets', 20], (oldData) => {
      if (!oldData) return { events: [newEvent] }
      const updatedEvents = [newEvent, ...(oldData.events ?? [])].slice(0, 20)
      return { events: updatedEvents }
    })
  }, [queryClient])

  const emitNewBetEvent = useCallback((betId: string, portfolioSize: number) => {
    window.dispatchEvent(
      new CustomEvent('bet-feed-new-bet', { detail: { betId, portfolioSize } })
    )
  }, [])

  const listeners: SSEEventListener[] = useMemo(() => [
    {
      type: 'bet-placed',
      handler: (event: MessageEvent) => {
        try {
          const data: BetPlacedEvent = JSON.parse(event.data)
          updateQueryCache(transformBetPlacedEvent(data))
          emitNewBetEvent(data.betId, data.portfolioSize)
        } catch (e) {
          console.error('[useBetsSSE] malformed SSE event:', e)
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
          console.error('[useBetsSSE] malformed SSE event:', e)
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
          console.error('[useBetsSSE] malformed SSE event:', e)
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
          console.error('[useBetsSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'signature-collected',
      handler: (event: MessageEvent) => {
        try {
          const data: SignatureCollectedEvent = JSON.parse(event.data)
          updateSignatureStatusFromEvent(queryClient, data)
          window.dispatchEvent(new CustomEvent('signature-collected', { detail: data }))
        } catch (e) {
          console.error('[useBetsSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'resolution-submitted',
      handler: (event: MessageEvent) => {
        try {
          const data: ResolutionSubmittedEvent = JSON.parse(event.data)
          updateSignatureStatusFromEvent(queryClient, data)
          window.dispatchEvent(new CustomEvent('resolution-submitted', { detail: data }))
        } catch (e) {
          console.error('[useBetsSSE] malformed SSE event:', e)
        }
      },
    },
  ], [queryClient, updateQueryCache, emitNewBetEvent])

  const pollingConfig = useMemo(() => ({
    fetchFn: async (backendUrl: string) => {
      try {
        const response = await fetch(`${backendUrl}/api/bets/recent?limit=20`)
        if (response.ok) {
          const data: RecentBetsResponse = await response.json()
          queryClient.setQueryData(['recent-bets', 20], data)
        }
      } catch (e) {
        console.error('[useBetsSSE] polling fetch failed:', e)
      }
    },
    interval: 30000,
  }), [queryClient])

  return useSSEConnection({
    path: '/api/sse/bets',
    listeners,
    maxReconnectAttempts: 3,
    polling: pollingConfig,
    handleVisibility: true,
    debugLabel: 'useBetsSSE',
  })
}
