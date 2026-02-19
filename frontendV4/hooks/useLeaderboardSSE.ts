'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LeaderboardResponse, AgentRanking } from '@/hooks/useLeaderboard'
import { getBackendUrl } from '@/lib/contracts/addresses'

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
 * SSE connection states
 */
export type SSEState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'disabled' | 'polling'

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
  /** Current connection state */
  state: SSEState
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
 * Hook for SSE integration with leaderboard
 * Connects to /api/leaderboard/live and updates TanStack Query cache on events
 * Implements exponential backoff for reconnection (1s, 2s, 4s, 8s, max 30s)
 * Falls back to polling after MAX_RECONNECT_ATTEMPTS failures
 *
 * Emits custom window events:
 * - 'leaderboard-rank-change': When an agent's rank changes
 *
 * @returns SSE connection state and status information
 */
export function useLeaderboardSSE(): UseLeaderboardSSEReturn {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<SSEState>('disconnected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  /**
   * Fetch leaderboard data via REST API (polling fallback)
   */
  const fetchLeaderboard = useCallback(async (backendUrl: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/leaderboard`)
      if (response.ok) {
        const rawData = await response.json()
        const data = transformLeaderboardData(rawData)
        queryClient.setQueryData(['leaderboard'], data)
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
    fetchLeaderboard(backendUrl)
    pollingIntervalRef.current = setInterval(() => {
      fetchLeaderboard(backendUrl)
    }, POLLING_INTERVAL)
  }, [fetchLeaderboard])

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
        const eventSource = new EventSource(`${backendUrl}/api/leaderboard/live`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          setState('connected')
          setReconnectAttempt(0) // Reset reconnect attempts on successful connection
        }

        // Handle default message event (leaderboard-update)
        eventSource.onmessage = (event) => {
          try {
            const rawData = JSON.parse(event.data)
            const data = transformLeaderboardData(rawData)

            // Update TanStack Query cache without triggering refetch
            queryClient.setQueryData(['leaderboard'], data)
          } catch {
            // Failed to parse SSE message - silently ignore malformed data
          }
        }

        // Handle specific leaderboard-update events
        eventSource.addEventListener('leaderboard-update', (event: MessageEvent) => {
          try {
            const rawData = JSON.parse(event.data)
            const data = transformLeaderboardData(rawData)

            // Update TanStack Query cache
            queryClient.setQueryData(['leaderboard'], data)
          } catch {
            // Silently ignore malformed events
          }
        })

        // Handle rank-change events
        eventSource.addEventListener('rank-change', (event: MessageEvent) => {
          try {
            const data: RankChangeEvent = JSON.parse(event.data)

            // Emit custom event for animation system
            window.dispatchEvent(
              new CustomEvent('leaderboard-rank-change', { detail: data })
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

    // Cleanup on unmount
    return () => {
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
  }, [queryClient, startPolling, stopPolling])

  return {
    state,
    isConnected: state === 'connected',
    isEnabled,
    reconnectAttempt,
    isPolling
  }
}
