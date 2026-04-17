'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface MarketRatio {
  assetId: string
  upStake: string
  downStake: string
  upPct: number
  downPct: number
  outcome: string
  pctChangeBps: number
}

export interface SettlementEvent {
  batchId: number
  sourceId: string
  markets: MarketRatio[]
}

interface UseSettlementSSEOptions {
  enabled?: boolean
  onSettlement?: (event: SettlementEvent) => void
}

/**
 * SSE hook for real-time Vision settlement events with parimutuel ratios.
 *
 * Connects to the oracle's SSE endpoint via the vision catch-all proxy.
 * Each event contains per-market UP/DOWN stake ratios for a settled batch.
 */
export function useSettlementSSE(options: UseSettlementSSEOptions = {}) {
  const { enabled = true, onSettlement } = options
  const queryClient = useQueryClient()
  const callbackRef = useRef(onSettlement)
  callbackRef.current = onSettlement
  const esRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)

  const handleEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const data: SettlementEvent = JSON.parse(event.data)
        queryClient.invalidateQueries({ queryKey: ['vision-batches'] })
        queryClient.invalidateQueries({ queryKey: ['vision-source-history', data.sourceId] })
        queryClient.invalidateQueries({ queryKey: ['vision-batch-ratios', data.batchId] })
        queryClient.invalidateQueries({ queryKey: ['vision-leaderboard'] })
        callbackRef.current?.(data)
      } catch {
        // malformed event
      }
    },
    [queryClient],
  )

  useEffect(() => {
    if (!enabled) return

    const es = new EventSource('/api/vision/sse/settlements')
    esRef.current = es

    es.addEventListener('batch-settled', handleEvent)
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
    }
  }, [enabled, handleEvent])

  return { connected }
}
