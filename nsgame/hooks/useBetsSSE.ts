'use client'

// Live bet stream over SSE. Subscribes to /api/events/stream and fans
// decoded events into optional callbacks. The hook owns the connection
// lifecycle; callers just register handlers.

import { useEffect, useRef, useState } from 'react'
import type {
  BetPlacedRow,
  ClaimedRow,
  MarketResolvedRow,
} from '@/lib/indexer/types'

export type BetSSEState = 'disconnected' | 'connecting' | 'connected' | 'error'

// Re-export wire types under the old names so component code keeps
// compiling. The old EVM-shaped events no longer exist; these match
// the Solana program's emit!() payloads.
export type BetPlacedSSEEvent    = BetPlacedRow
export type ClaimedSSEEvent      = ClaimedRow
export type MarketResolvedSSEEvent = MarketResolvedRow
export type BetSSEEvent = BetPlacedRow | ClaimedRow | MarketResolvedRow

export interface UseBetsSSEOptions {
  enabled?: boolean
  onBetPlaced?: (e: BetPlacedRow) => void
  onMarketResolved?: (e: MarketResolvedRow) => void
  onClaimed?: (e: ClaimedRow) => void
}

export interface UseBetsSSEReturn {
  state: BetSSEState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
  isPolling: boolean
}

export function useBetsSSE(opts: UseBetsSSEOptions = {}): UseBetsSSEReturn {
  const { enabled = true, onBetPlaced, onMarketResolved, onClaimed } = opts
  const [state, setState] = useState<BetSSEState>(enabled ? 'connecting' : 'disconnected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const esRef = useRef<EventSource | null>(null)

  // Stash callbacks in refs so changes don't tear down the stream.
  const placedRef = useRef(onBetPlaced)
  const resolvedRef = useRef(onMarketResolved)
  const claimedRef = useRef(onClaimed)
  placedRef.current = onBetPlaced
  resolvedRef.current = onMarketResolved
  claimedRef.current = onClaimed

  useEffect(() => {
    if (!enabled) {
      setState('disconnected')
      esRef.current?.close()
      esRef.current = null
      return
    }

    let attempt = 0
    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (closed) return
      setState('connecting')
      const es = new EventSource('/api/events/stream')
      esRef.current = es

      es.addEventListener('open', () => {
        attempt = 0
        setReconnectAttempt(0)
        setState('connected')
      })

      es.addEventListener('BetPlaced', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as BetPlacedRow
          placedRef.current?.(data)
        } catch (err) {
          console.warn('[useBetsSSE] failed to parse BetPlaced', err)
        }
      })

      es.addEventListener('MarketResolved', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as MarketResolvedRow
          resolvedRef.current?.(data)
        } catch (err) {
          console.warn('[useBetsSSE] failed to parse MarketResolved', err)
        }
      })

      es.addEventListener('Claimed', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as ClaimedRow
          claimedRef.current?.(data)
        } catch (err) {
          console.warn('[useBetsSSE] failed to parse Claimed', err)
        }
      })

      es.addEventListener('error', () => {
        if (closed) return
        setState('error')
        es.close()
        // Exponential backoff, cap 30s. EventSource reconnects on its
        // own, but only on network errors — we close explicitly so the
        // retry policy is ours.
        const delay = Math.min(30_000, 1_000 * 2 ** attempt)
        attempt += 1
        setReconnectAttempt(attempt)
        reconnectTimer = setTimeout(connect, delay)
      })
    }

    connect()
    return () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      esRef.current?.close()
      esRef.current = null
    }
  }, [enabled])

  return {
    state,
    isConnected: state === 'connected',
    isEnabled: enabled,
    reconnectAttempt,
    isPolling: false,
  }
}
