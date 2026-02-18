'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'
import type { RecentBetEvent, RecentBetsResponse } from '@/hooks/useRecentBets'
import { updateSignatureStatusFromEvent } from '@/hooks/useResolutionSignatures'
import type { SignatureCollectedEvent, ResolutionSubmittedEvent } from '@/lib/types/resolution'

/**
 * SSE connection states for bet feed
 */
export type BetSSEState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'disabled' | 'polling'

/**
 * SSE event types from backend (Story 6-1)
 */
export interface BetPlacedEvent {
  type: 'BetPlaced'
  betId: string
  creator: string // wallet address
  portfolioSize: number
  tradeCount?: number  // Epic 8: backend sends tradeCount
  amount: string // decimal as string
  timestamp: string // ISO timestamp
}

export interface BetMatchedEvent {
  type: 'BetMatched'
  betId: string
  matcher: string // wallet address
  amount: string
  timestamp: string
}

export interface BetSettledEvent {
  type: 'BetSettled'
  betId: string
  winner: string // wallet address
  pnl: string // decimal as string (can be negative)
  portfolioSize: number
  tradeCount?: number  // Epic 8: backend sends tradeCount
  timestamp: string
}

export interface BetEarlyExitEvent {
  type: 'BetEarlyExit'
  betId: string
  creator: string // wallet address
  filler: string // wallet address
  creatorAmount: string // decimal as string
  fillerAmount: string // decimal as string
  timestamp: string
}

/**
 * Return type for useBetsSSE hook
 */
export interface UseBetsSSEReturn {
  /** Current connection state */
  state: BetSSEState
  /** Whether SSE is connected and receiving updates */
  isConnected: boolean
  /** Whether SSE is enabled (backend URL configured) */
  isEnabled: boolean
  /** Current reconnection attempt number (0 when connected) */
  reconnectAttempt: number
  /** Whether using polling fallback */
  isPolling: boolean
}

/** Maximum reconnection attempts before falling back to polling */
const MAX_RECONNECT_ATTEMPTS = 3

/** Polling interval when SSE fails (30 seconds) */
const POLLING_INTERVAL = 30000

/**
 * Transform BetPlaced SSE event to RecentBetEvent format
 */
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

/**
 * Transform BetMatched SSE event to RecentBetEvent format
 */
function transformBetMatchedEvent(data: BetMatchedEvent): RecentBetEvent {
  return {
    betId: data.betId,
    walletAddress: data.matcher,
    eventType: 'matched',
    portfolioSize: 0, // Not provided in match event
    amount: data.amount,
    result: null,
    timestamp: data.timestamp
  }
}

/**
 * Transform BetSettled SSE event to RecentBetEvent format
 */
function transformBetSettledEvent(data: BetSettledEvent): RecentBetEvent {
  const pnl = parseFloat(data.pnl)
  const eventType = pnl >= 0 ? 'won' : 'lost'

  return {
    betId: data.betId,
    walletAddress: data.winner,
    eventType,
    portfolioSize: data.tradeCount ?? data.portfolioSize ?? 0,
    amount: '0', // Settlement event doesn't include original amount
    result: data.pnl,
    timestamp: data.timestamp
  }
}

/**
 * Transform BetEarlyExit SSE event to RecentBetEvent format (Story 14-1)
 */
function transformBetEarlyExitEvent(data: BetEarlyExitEvent): RecentBetEvent {
  return {
    betId: data.betId,
    walletAddress: data.creator, // Show creator as primary participant
    eventType: 'settled', // Early exits show as settled
    portfolioSize: 0,
    amount: '0',
    result: null, // Early exit doesn't have a clear winner/loser
    timestamp: data.timestamp
  }
}

/**
 * Hook for SSE integration with bet feed
 * Connects to /api/sse/bets and updates TanStack Query cache on events
 * Implements exponential backoff for reconnection (1s, 2s, 4s, 8s, max 30s)
 * Falls back to polling after MAX_RECONNECT_ATTEMPTS failures
 * Pauses SSE when tab is hidden, resumes when visible (resource optimization)
 *
 * Emits custom window events:
 * - 'bet-feed-new-bet': When a new bet event is received (for animation triggers)
 *
 * @returns SSE connection state and status information
 */
export function useBetsSSE(): UseBetsSSEReturn {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<BetSSEState>('disconnected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  /**
   * Update TanStack Query cache with new bet event
   * Prepends new event to existing list, maintains max 20 items
   */
  const updateQueryCache = useCallback((newEvent: RecentBetEvent) => {
    queryClient.setQueryData<RecentBetsResponse>(['recent-bets', 20], (oldData) => {
      if (!oldData) {
        return { events: [newEvent] }
      }

      // Prepend new event, keep max 20
      const updatedEvents = [newEvent, ...(oldData.events ?? [])].slice(0, 20)
      return { events: updatedEvents }
    })
  }, [queryClient])

  /**
   * Emit custom window event for animation system
   */
  const emitNewBetEvent = useCallback((betId: string, portfolioSize: number) => {
    window.dispatchEvent(
      new CustomEvent('bet-feed-new-bet', {
        detail: { betId, portfolioSize }
      })
    )
  }, [])

  /**
   * Fetch recent bets via REST API (polling fallback)
   */
  const fetchRecentBets = useCallback(async (backendUrl: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/bets/recent?limit=20`)
      if (response.ok) {
        const data: RecentBetsResponse = await response.json()
        queryClient.setQueryData(['recent-bets', 20], data)
      }
    } catch {
      // Silently ignore fetch errors during polling
    }
  }, [queryClient])

  /**
   * Start polling fallback mode
   */
  const startPolling = useCallback((backendUrl: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    setIsPolling(true)
    setState('polling')

    // Fetch immediately, then set up interval
    fetchRecentBets(backendUrl)
    pollingIntervalRef.current = setInterval(() => {
      fetchRecentBets(backendUrl)
    }, POLLING_INTERVAL)
  }, [fetchRecentBets])

  /**
   * Stop polling mode
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
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
      // Stop polling if we're attempting to reconnect SSE
      stopPolling()

      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setState('connecting')

      try {
        const eventSource = new EventSource(`${backendUrl}/api/sse/bets`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          setState('connected')
          setReconnectAttempt(0) // Reset reconnect attempts on successful connection
        }

        // Handle bet-placed events
        eventSource.addEventListener('bet-placed', (event: MessageEvent) => {
          try {
            const data: BetPlacedEvent = JSON.parse(event.data)
            const transformedEvent = transformBetPlacedEvent(data)

            // Update cache
            updateQueryCache(transformedEvent)

            // Emit event for animation system
            emitNewBetEvent(data.betId, data.portfolioSize)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle bet-matched events
        eventSource.addEventListener('bet-matched', (event: MessageEvent) => {
          try {
            const data: BetMatchedEvent = JSON.parse(event.data)
            const transformedEvent = transformBetMatchedEvent(data)

            // Update cache
            updateQueryCache(transformedEvent)

            // Emit event for animation system
            emitNewBetEvent(data.betId, 0)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle bet-settled events
        eventSource.addEventListener('bet-settled', (event: MessageEvent) => {
          try {
            const data: BetSettledEvent = JSON.parse(event.data)
            const transformedEvent = transformBetSettledEvent(data)

            // Update cache
            updateQueryCache(transformedEvent)

            // Emit event for animation system
            emitNewBetEvent(data.betId, data.portfolioSize)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle bet-early-exit events (Story 14-1)
        eventSource.addEventListener('bet-early-exit', (event: MessageEvent) => {
          try {
            const data: BetEarlyExitEvent = JSON.parse(event.data)
            const transformedEvent = transformBetEarlyExitEvent(data)

            // Update cache
            updateQueryCache(transformedEvent)

            // Emit event for animation system
            emitNewBetEvent(data.betId, 0)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Story 14.3: Handle signature-collected events
        eventSource.addEventListener('signature-collected', (event: MessageEvent) => {
          try {
            const data: SignatureCollectedEvent = JSON.parse(event.data)
            // Update signature status cache
            updateSignatureStatusFromEvent(queryClient, data)

            // Emit custom event for UI updates
            window.dispatchEvent(
              new CustomEvent('signature-collected', {
                detail: data
              })
            )
          } catch {
            // Silently ignore malformed events
          }
        })

        // Story 14.3: Handle resolution-submitted events
        eventSource.addEventListener('resolution-submitted', (event: MessageEvent) => {
          try {
            const data: ResolutionSubmittedEvent = JSON.parse(event.data)
            // Update signature status cache
            updateSignatureStatusFromEvent(queryClient, data)

            // Emit custom event for UI updates
            window.dispatchEvent(
              new CustomEvent('resolution-submitted', {
                detail: data
              })
            )
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

            // Check if we should fall back to polling
            if (newAttempt >= MAX_RECONNECT_ATTEMPTS) {
              // Fall back to polling mode
              startPolling(backendUrl)
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

          // Check if we should fall back to polling
          if (newAttempt >= MAX_RECONNECT_ATTEMPTS) {
            startPolling(backendUrl)
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

    // AC6: Tab visibility handling - pause when hidden, resume when visible
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
        stopPolling()
        setState('disconnected')
      } else {
        // Tab is visible - reconnect SSE
        setReconnectAttempt(0) // Reset attempts when tab becomes visible
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
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      setState('disconnected')
    }
  }, [queryClient, startPolling, stopPolling, updateQueryCache, emitNewBetEvent])

  return {
    state,
    isConnected: state === 'connected',
    isEnabled,
    reconnectAttempt,
    isPolling
  }
}
