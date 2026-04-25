'use client'

/**
 * useGlobalActivity — a network-wide event feed across every wallet.
 *
 * Polls /api/activity every 15 seconds, coerces string-encoded BigInts
 * into bigints, and returns the events newest-first. Stable identity by
 * signature so React's reconciler doesn't churn rows that haven't moved.
 */

import { useEffect, useMemo, useState } from 'react'

export type ActivityKind = 'bet' | 'resolved' | 'claim'

export interface ActivityEvent {
  kind: ActivityKind
  signature: string
  slot: number
  blockTime: number | null
  market: string
  pairIndex: number | null
  owner: string | null
  // bet
  side?: 'yes' | 'no'
  amount?: bigint
  // resolved
  outcomeYes?: boolean
  finalPrice?: bigint
  // claim
  net?: bigint
  stranded?: boolean
}

interface ActivityEventDTO {
  kind: ActivityKind
  signature: string
  slot: string
  blockTime: number | null
  market: string
  pairIndex: number | null
  owner: string | null
  side?: 'yes' | 'no'
  amount?: string
  outcomeYes?: boolean
  finalPrice?: string
  net?: string
  stranded?: boolean
}

const POLL_MS = 15_000
const DEFAULT_LIMIT = 10

function safeBig(v: string | undefined | null): bigint | undefined {
  if (v == null) return undefined
  try { return BigInt(v) } catch { return undefined }
}

function safeSlot(v: string): number {
  // Slots fit comfortably in an i53. If a bad value sneaks in, fall back
  // to 0 so ordering keeps working.
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface UseGlobalActivityReturn {
  events: ActivityEvent[]
  loading: boolean
}

export function useGlobalActivity(limit: number = DEFAULT_LIMIT): UseGlobalActivityReturn {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/activity?limit=${limit}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as { events?: ActivityEventDTO[] }
        if (cancelled) return
        const next: ActivityEvent[] = (payload.events ?? []).map(e => ({
          kind: e.kind,
          signature: e.signature,
          slot: safeSlot(e.slot),
          blockTime: e.blockTime,
          market: e.market,
          pairIndex: e.pairIndex,
          owner: e.owner,
          side: e.side,
          amount: safeBig(e.amount),
          outcomeYes: e.outcomeYes,
          finalPrice: safeBig(e.finalPrice),
          net: safeBig(e.net),
          stranded: e.stranded,
        }))
        setEvents(next)
      } catch {
        // Indexer offline — keep the last snapshot.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [limit])

  return useMemo(() => ({ events, loading }), [events, loading])
}
