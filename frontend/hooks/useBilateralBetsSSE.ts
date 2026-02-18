'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'
import type { BilateralBet, BilateralBetsListResponse } from '@/lib/types/bilateral-bet'

/**
 * SSE connection states for bilateral bets feed
 */
export type BilateralBetsSSEState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'disabled'

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

/**
 * Return type for useBilateralBetsSSE hook
 */
export interface UseBilateralBetsSSEReturn {
  /** Current connection state */
  state: BilateralBetsSSEState
  /** Whether SSE is connected and receiving updates */
  isConnected: boolean
  /** Whether SSE is enabled (backend URL configured) */
  isEnabled: boolean
  /** Current reconnection attempt number (0 when connected) */
  reconnectAttempt: number
}

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5

/**
 * Hook for SSE integration with bilateral bets feed
 * Connects to /api/sse/bets and listens for bilateral bet events
 * Updates TanStack Query cache on events for real-time updates
 *
 * Events handled:
 * - bet-committed: New bilateral bet committed
 * - bet-settled: Bet settled (by agreement or arbitration)
 * - arbitration-requested: Dispute initiated
 * - custom-payout: Custom payout executed
 *
 * @returns SSE connection state and status information
 */
export function useBilateralBetsSSE(): UseBilateralBetsSSEReturn {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<BilateralBetsSSEState>('disconnected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [isEnabled, setIsEnabled] = useState(true)

  /**
   * Invalidate bilateral bets queries to trigger refetch
   */
  const invalidateBilateralBetsQueries = useCallback((betId?: number) => {
    // Invalidate list queries
    queryClient.invalidateQueries({ queryKey: ['bilateral-bets'] })
    queryClient.invalidateQueries({ queryKey: ['user-bilateral-bets'] })

    // Invalidate specific bet query if betId provided
    if (betId !== undefined) {
      queryClient.invalidateQueries({ queryKey: ['bilateral-bet', betId] })
      queryClient.invalidateQueries({ queryKey: ['arbitration-status', betId] })
    }
  }, [queryClient])

  /**
   * Emit custom window event for UI notifications
   */
  const emitBilateralBetEvent = useCallback((eventType: string, data: unknown) => {
    window.dispatchEvent(
      new CustomEvent(`bilateral-bet-${eventType}`, { detail: data })
    )
  }, [])

  useEffect(() => {
    let backendUrl: string
    try {
      backendUrl = getBackendUrl()
    } catch {
      // Backend URL not configured - SSE disabled
      setState('disabled')
      setIsEnabled(false)
      return
    }

    const maxReconnectDelay = 30000 // 30 seconds max
    const baseDelay = 1000 // 1 second initial delay

    /**
     * Calculate reconnection delay with exponential backoff
     */
    function getReconnectDelay(attempt: number): number {
      const delay = baseDelay * Math.pow(2, attempt)
      return Math.min(delay, maxReconnectDelay)
    }

    /**
     * Connect to SSE endpoint
     */
    function connect() {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setState('connecting')

      try {
        // Use the same SSE endpoint as regular bets - it broadcasts all events
        const eventSource = new EventSource(`${backendUrl}/api/sse/bets`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          setState('connected')
          setReconnectAttempt(0)
        }

        // Handle bet-committed events (bilateral bet created)
        eventSource.addEventListener('bet-committed', (event: MessageEvent) => {
          try {
            const data: BetCommittedEvent = JSON.parse(event.data)
            invalidateBilateralBetsQueries(data.betId)
            emitBilateralBetEvent('committed', data)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle bet-settled events (bilateral bet settled)
        eventSource.addEventListener('bet-settled', (event: MessageEvent) => {
          try {
            const data: BetSettledEvent = JSON.parse(event.data)
            invalidateBilateralBetsQueries(data.betId)
            emitBilateralBetEvent('settled', data)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle arbitration-requested events
        eventSource.addEventListener('arbitration-requested', (event: MessageEvent) => {
          try {
            const data: ArbitrationRequestedEvent = JSON.parse(event.data)
            invalidateBilateralBetsQueries(data.betId)
            emitBilateralBetEvent('arbitration-requested', data)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle custom-payout events
        eventSource.addEventListener('custom-payout', (event: MessageEvent) => {
          try {
            const data: CustomPayoutEvent = JSON.parse(event.data)
            invalidateBilateralBetsQueries(data.betId)
            emitBilateralBetEvent('custom-payout', data)
          } catch {
            // Silently ignore malformed events
          }
        })

        eventSource.onerror = () => {
          setState('error')

          // Close the connection
          eventSource.close()
          eventSourceRef.current = null

          // Schedule reconnection with exponential backoff
          setReconnectAttempt((prev) => {
            const newAttempt = prev + 1

            if (newAttempt >= MAX_RECONNECT_ATTEMPTS) {
              // Give up after max attempts
              setState('error')
              return newAttempt
            }

            const delay = getReconnectDelay(newAttempt)

            reconnectTimeoutRef.current = setTimeout(() => {
              connect()
            }, delay)

            return newAttempt
          })
        }
      } catch {
        setState('error')

        // Schedule reconnection
        setReconnectAttempt((prev) => {
          const newAttempt = prev + 1

          if (newAttempt >= MAX_RECONNECT_ATTEMPTS) {
            return newAttempt
          }

          const delay = getReconnectDelay(newAttempt)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)

          return newAttempt
        })
      }
    }

    // Initial connection
    connect()

    // Tab visibility handling - pause when hidden, resume when visible
    function handleVisibilityChange() {
      if (document.hidden) {
        // Tab is hidden - close SSE to save resources
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        setState('disconnected')
      } else {
        // Tab is visible - reconnect SSE
        setReconnectAttempt(0)
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      setState('disconnected')
    }
  }, [queryClient, invalidateBilateralBetsQueries, emitBilateralBetEvent])

  return {
    state,
    isConnected: state === 'connected',
    isEnabled,
    reconnectAttempt,
  }
}
