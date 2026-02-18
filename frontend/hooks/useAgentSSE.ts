'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'
import type { RecentBetEvent, RecentBetsResponse } from '@/hooks/useRecentBets'
import type { BetPlacedEvent, BetMatchedEvent, BetSettledEvent, BetEarlyExitEvent } from '@/hooks/useBetsSSE'

/**
 * SSE connection states for agent-specific feed
 */
export type AgentSSEState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'disabled' | 'polling'

/**
 * Return type for useAgentSSE hook
 */
export interface UseAgentSSEReturn {
  /** Current connection state */
  state: AgentSSEState
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
    walletAddress: data.creator,
    eventType: 'settled',
    portfolioSize: 0,
    amount: '0',
    result: null,
    timestamp: data.timestamp
  }
}

/**
 * Hook for SSE integration with agent-specific bet feed
 * Connects to /api/sse/agent/{address} and updates TanStack Query cache on events
 * Implements exponential backoff for reconnection (1s, 2s, 4s, 8s, max 30s)
 * Falls back to polling after MAX_RECONNECT_ATTEMPTS failures
 * Pauses SSE when tab is hidden, resumes when visible (AC6)
 *
 * Emits custom window events:
 * - 'agent-bet-new': When a new bet event is received (for animation triggers)
 *
 * @param walletAddress - The wallet address of the agent to subscribe to
 * @param limit - Maximum number of events to keep in cache (default: 10)
 * @returns SSE connection state and status information
 */
export function useAgentSSE(walletAddress: string, limit: number = 10): UseAgentSSEReturn {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<AgentSSEState>('disconnected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  /**
   * Update TanStack Query cache with new bet event for agent-specific bets
   * Prepends new event to existing list, maintains max items based on limit
   */
  const updateQueryCache = useCallback((newEvent: RecentBetEvent) => {
    queryClient.setQueryData<RecentBetsResponse>(['agent-bets', walletAddress, limit], (oldData) => {
      if (!oldData) {
        return { events: [newEvent] }
      }

      // Prepend new event, keep max based on limit
      const updatedEvents = [newEvent, ...(oldData.events ?? [])].slice(0, limit)
      return { events: updatedEvents }
    })
  }, [queryClient, walletAddress, limit])

  /**
   * Emit custom window event for animation system (matching useBetsSSE behavior)
   */
  const emitNewBetEvent = useCallback((betId: string, portfolioSize: number) => {
    window.dispatchEvent(
      new CustomEvent('agent-bet-new', {
        detail: { betId, portfolioSize, walletAddress }
      })
    )
  }, [walletAddress])

  /**
   * Fetch agent bets via REST API (polling fallback)
   */
  const fetchAgentBets = useCallback(async (backendUrl: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/agents/${walletAddress}/bets?limit=${limit}`)
      if (response.ok) {
        const data: RecentBetsResponse = await response.json()
        queryClient.setQueryData(['agent-bets', walletAddress, limit], data)
      }
    } catch {
      // Silently ignore fetch errors during polling
    }
  }, [queryClient, walletAddress, limit])

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
    fetchAgentBets(backendUrl)
    pollingIntervalRef.current = setInterval(() => {
      fetchAgentBets(backendUrl)
    }, POLLING_INTERVAL)
  }, [fetchAgentBets])

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
    // Don't connect if no wallet address provided
    if (!walletAddress) {
      setState('disabled')
      setIsEnabled(false)
      return
    }

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
        const eventSource = new EventSource(`${backendUrl}/api/sse/agent/${walletAddress}`)
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
            updateQueryCache(transformedEvent)
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
            updateQueryCache(transformedEvent)
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
            updateQueryCache(transformedEvent)
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
            updateQueryCache(transformedEvent)
            emitNewBetEvent(data.betId, 0)
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

    // Cleanup on unmount or when wallet address changes
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
  }, [walletAddress, queryClient, startPolling, stopPolling, updateQueryCache, emitNewBetEvent])

  return {
    state,
    isConnected: state === 'connected',
    isEnabled,
    reconnectAttempt,
    isPolling
  }
}
