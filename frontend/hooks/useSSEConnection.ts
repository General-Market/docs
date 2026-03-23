'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * SSE connection states — shared across all SSE hooks
 */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'disabled' | 'polling'

/**
 * An event listener to register on the EventSource.
 * The hook registers these after connection, removes them on close.
 */
export interface SSEEventListener {
  /** SSE event type (e.g. 'bet-placed', 'leaderboard-update') */
  type: string
  /** Handler — receives the raw MessageEvent */
  handler: (event: MessageEvent) => void
}

/**
 * Polling fallback configuration. Optional — omit to disable polling entirely.
 */
export interface SSEPollingConfig {
  /** REST fetch to execute on each poll tick */
  fetchFn: (backendUrl: string) => Promise<void>
  /** Interval in ms (default 30000) */
  interval?: number
}

/**
 * Configuration for useSSEConnection
 */
export interface UseSSEConnectionConfig {
  /** Path appended to backendUrl (e.g. '/api/sse/bets') */
  path: string
  /** Named event listeners to attach after open */
  listeners: SSEEventListener[]
  /** Optional onmessage handler (the default unnamed event) */
  onMessage?: (event: MessageEvent) => void
  /** Max reconnect attempts before giving up or falling back to polling (default 3) */
  maxReconnectAttempts?: number
  /** Optional polling fallback — if omitted, hook simply stops after max attempts */
  polling?: SSEPollingConfig
  /** Whether this hook should manage visibility changes (default true) */
  handleVisibility?: boolean
  /** Whether the connection is enabled — false disables connection entirely */
  enabled?: boolean
  /** Hook name for console logging */
  debugLabel?: string
}

/**
 * Return type — everything a consumer needs to render status or introspect
 */
export interface UseSSEConnectionReturn {
  state: SSEConnectionState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
  isPolling: boolean
}

const BASE_DELAY = 1000
const MAX_DELAY = 30000
const DEFAULT_POLLING_INTERVAL = 30000

function getReconnectDelay(attempt: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY)
}

/**
 * Shared SSE connection hook.
 *
 * Manages: EventSource lifecycle, exponential backoff reconnection,
 * visibility-change pause/resume, optional polling fallback, cleanup on unmount.
 *
 * Consumers provide: URL path, event listeners, optional polling config.
 */
export function useSSEConnection(config: UseSSEConnectionConfig): UseSSEConnectionReturn {
  const {
    path,
    listeners,
    onMessage,
    maxReconnectAttempts = 3,
    polling,
    handleVisibility = true,
    enabled = true,
    debugLabel = 'useSSEConnection',
  } = config

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<SSEConnectionState>('disconnected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  // Stable ref for listeners so the effect doesn't re-run on every render
  const listenersRef = useRef(listeners)
  listenersRef.current = listeners
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const pollingRef = useRef(polling)
  pollingRef.current = polling

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setState('disabled')
      setIsEnabled(false)
      return
    }

    let backendUrl: string
    try {
      backendUrl = getBackendUrl()
    } catch {
      setState('disabled')
      setIsEnabled(false)
      return
    }
    if (!backendUrl) {
      setState('disabled')
      setIsEnabled(false)
      return
    }

    function startPolling() {
      const cfg = pollingRef.current
      if (!cfg) return // No polling configured — stay in error state

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      setIsPolling(true)
      setState('polling')

      const interval = cfg.interval ?? DEFAULT_POLLING_INTERVAL
      cfg.fetchFn(backendUrl)
      pollingIntervalRef.current = setInterval(() => {
        cfg.fetchFn(backendUrl)
      }, interval)
    }

    function scheduleReconnect(attempt: number) {
      if (attempt >= maxReconnectAttempts) {
        startPolling()
        return
      }
      const delay = getReconnectDelay(attempt)
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, delay)
    }

    function connect() {
      // Stop polling if we're re-attempting SSE
      stopPolling()

      // Tear down existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setState('connecting')

      try {
        const es = new EventSource(`${backendUrl}${path}`)
        eventSourceRef.current = es

        es.onopen = () => {
          setState('connected')
          setReconnectAttempt(0)
        }

        // Register the default onmessage handler if provided
        if (onMessageRef.current) {
          es.onmessage = (event) => {
            onMessageRef.current?.(event)
          }
        }

        // Register named event listeners
        for (const listener of listenersRef.current) {
          es.addEventListener(listener.type, listener.handler)
        }

        es.onerror = () => {
          setState('error')
          es.close()
          eventSourceRef.current = null

          setReconnectAttempt((prev) => {
            const next = prev + 1
            scheduleReconnect(next)
            return next
          })
        }
      } catch (e) {
        console.error(`[${debugLabel}] EventSource connection failed:`, e)
        setState('error')

        setReconnectAttempt((prev) => {
          const next = prev + 1
          scheduleReconnect(next)
          return next
        })
      }
    }

    // Initial connection
    connect()

    // Visibility handling — pause when hidden, resume when visible
    function handleVisibilityChange() {
      if (document.hidden) {
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
        setReconnectAttempt(0)
        connect()
      }
    }

    if (handleVisibility) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    // Cleanup on unmount
    return () => {
      if (handleVisibility) {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, maxReconnectAttempts, handleVisibility, stopPolling, debugLabel])

  return {
    state,
    isConnected: state === 'connected',
    isEnabled,
    reconnectAttempt,
    isPolling,
  }
}
