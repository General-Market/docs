'use client'

// Global feed of recent bet events. Fetches from /api/events/recent,
// refetches on focus and every 30s. Types survive across the wire as
// strings so u64 amounts stay intact.

import { useEffect, useState, useCallback, useRef } from 'react'
import type { BetPlacedRow } from '@/lib/indexer/types'

export type BetEventType =
  | 'BetPlaced'
  | 'BetExited'
  | 'MarketInstantiated'
  | 'MarketClosed'
  | 'MarketResolved'
  | 'Claimed'

export interface RecentBetEvent {
  eventType: BetEventType
  marketPda: string
  walletAddress: string
  sourceId: number | null
  thresholdBps: number | null
  /** u64 stake-mint amount, as decimal string. */
  amount: string
  /** Block time (unix seconds) as string, or null when unknown. */
  timestamp: string | null
  signature: string
  /** 0 = YES, 1 = NO */
  side: number
}

interface UseRecentBetsReturn {
  events: RecentBetEvent[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

const REFETCH_INTERVAL_MS = 30_000

interface ApiResponse {
  events?: BetPlacedRow[]
  error?: string
}

function toRecent(r: BetPlacedRow): RecentBetEvent {
  return {
    eventType: 'BetPlaced',
    marketPda: r.market,
    walletAddress: r.owner,
    sourceId: r.marketMeta?.sourceId ?? null,
    thresholdBps: r.marketMeta?.thresholdBps ?? null,
    amount: r.amount,
    timestamp: r.blockTime,
    signature: r.signature,
    side: r.side,
  }
}

export function useRecentBets(limit: number = 50): UseRecentBetsReturn {
  const [events, setEvents] = useState<RecentBetEvent[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchNow = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/recent?limit=${encodeURIComponent(String(limit))}`, {
        cache: 'no-store',
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`recent fetch failed: ${res.status}`)
      const body = (await res.json()) as ApiResponse
      setEvents((body.events ?? []).map(toRecent))
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return
      setError(e instanceof Error ? e : new Error(String(e)))
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchNow()
    const id = setInterval(fetchNow, REFETCH_INTERVAL_MS)
    return () => {
      clearInterval(id)
      abortRef.current?.abort()
    }
  }, [fetchNow])

  return {
    events,
    isLoading,
    isError: error !== null,
    error,
    refetch: fetchNow,
  }
}
