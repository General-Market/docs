'use client'

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSSEConnection, SSEConnectionState, SSEEventListener } from '@/hooks/useSSEConnection'

export type BilateralBetsSSEState = SSEConnectionState

/**
 * SSE event types for bilateral bets (from CollateralVault indexer)
 */
export interface BetCommittedEvent {
  type: 'bet-committed'
  betId: number
  creator: string
  filler: string
  tradesRoot: string
  creatorAmount: string
  fillerAmount: string
  totalAmount: string
  deadline: string
  timestamp: string
}

export interface BetSettledEvent {
  type: 'bet-settled'
  betId: number
  winner: string
  resolutionType: string
  timestamp: string
}

export interface ArbitrationRequestedEvent {
  type: 'arbitration-requested'
  betId: number
  requestedBy: string
  timestamp: string
}

export interface CustomPayoutEvent {
  type: 'custom-payout'
  betId: number
  creatorPayout: string
  fillerPayout: string
  timestamp: string
}

export interface UseBilateralBetsSSEReturn {
  state: BilateralBetsSSEState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
}

/**
 * SSE hook for bilateral bets feed.
 * Connects to /api/sse/bets — listens for bilateral bet events.
 * No polling fallback — stays in error state after 5 failed attempts.
 */
export function useBilateralBetsSSE(): UseBilateralBetsSSEReturn {
  const queryClient = useQueryClient()

  const invalidateBilateralBetsQueries = useCallback((betId?: number) => {
    queryClient.invalidateQueries({ queryKey: ['bilateral-bets'] })
    queryClient.invalidateQueries({ queryKey: ['user-bilateral-bets'] })
    if (betId !== undefined) {
      queryClient.invalidateQueries({ queryKey: ['bilateral-bet', betId] })
      queryClient.invalidateQueries({ queryKey: ['arbitration-status', betId] })
    }
  }, [queryClient])

  const emitBilateralBetEvent = useCallback((eventType: string, data: unknown) => {
    window.dispatchEvent(
      new CustomEvent(`bilateral-bet-${eventType}`, { detail: data })
    )
  }, [])

  const listeners: SSEEventListener[] = useMemo(() => [
    {
      type: 'bet-committed',
      handler: (event: MessageEvent) => {
        try {
          const data: BetCommittedEvent = JSON.parse(event.data)
          invalidateBilateralBetsQueries(data.betId)
          emitBilateralBetEvent('committed', data)
        } catch (e) {
          console.error('[useBilateralBetsSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'bet-settled',
      handler: (event: MessageEvent) => {
        try {
          const data: BetSettledEvent = JSON.parse(event.data)
          invalidateBilateralBetsQueries(data.betId)
          emitBilateralBetEvent('settled', data)
        } catch (e) {
          console.error('[useBilateralBetsSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'arbitration-requested',
      handler: (event: MessageEvent) => {
        try {
          const data: ArbitrationRequestedEvent = JSON.parse(event.data)
          invalidateBilateralBetsQueries(data.betId)
          emitBilateralBetEvent('arbitration-requested', data)
        } catch (e) {
          console.error('[useBilateralBetsSSE] malformed SSE event:', e)
        }
      },
    },
    {
      type: 'custom-payout',
      handler: (event: MessageEvent) => {
        try {
          const data: CustomPayoutEvent = JSON.parse(event.data)
          invalidateBilateralBetsQueries(data.betId)
          emitBilateralBetEvent('custom-payout', data)
        } catch (e) {
          console.error('[useBilateralBetsSSE] malformed SSE event:', e)
        }
      },
    },
  ], [invalidateBilateralBetsQueries, emitBilateralBetEvent])

  const { state, isConnected, isEnabled, reconnectAttempt } = useSSEConnection({
    path: '/api/sse/bets',
    listeners,
    maxReconnectAttempts: 5,
    // No polling config — bilateral bets has no fallback
    handleVisibility: true,
    debugLabel: 'useBilateralBetsSSE',
  })

  return { state, isConnected, isEnabled, reconnectAttempt }
}
