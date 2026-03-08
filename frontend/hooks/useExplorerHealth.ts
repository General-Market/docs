'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

/** Aggregated across all nodes — no per-node data exposed */
export interface AggregatedSnapshot {
  poll_batch_ts: string
  quorum_met: boolean
  worst_status: string
  consensus_rounds_total: number
  consensus_success_total: number
  consensus_failed_total: number
  signatures_collected: number
  avg_consensus_time_ms: number
  avg_cycle_duration_ms: number
  orders_processed_last_60s: number
  pending_order_count: number
  total_peers: number
  p2p_messages_received: number
  p2p_messages_sent: number
  total_peers_healthy: number
  total_peers_unhealthy: number
}

interface UseExplorerHealthReturn {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
  error: string | null
  range: TimeRange
  setRange: (r: TimeRange) => void
  refresh: () => Promise<void>
}

const POLL_INTERVAL_MS = 60_000

export function useExplorerHealth(): UseExplorerHealthReturn {
  const [snapshots, setSnapshots] = useState<AggregatedSnapshot[]>([])
  const [latest, setLatest] = useState<AggregatedSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<TimeRange>('24h')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [histRes, latestRes] = await Promise.all([
        fetch(`/api/explorer/health?endpoint=history&range=${range}`, {
          signal: AbortSignal.timeout(15_000),
        }),
        fetch(`/api/explorer/health?endpoint=latest`, {
          signal: AbortSignal.timeout(15_000),
        }),
      ])

      if (!histRes.ok) throw new Error(`History: HTTP ${histRes.status}`)
      if (!latestRes.ok) throw new Error(`Latest: HTTP ${latestRes.status}`)

      const histData = await histRes.json()
      const latestData = await latestRes.json()

      setSnapshots(histData.snapshots || [])
      setLatest(latestData.network || null)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch explorer data')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    refresh()
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { snapshots, latest, loading, error, range, setRange, refresh }
}

/** Compute deltas between consecutive aggregated snapshots for rate charts.
 *  Clamps negative deltas to 0 (counter reset detection on issuer restart). */
export function computeDeltas(
  snapshots: AggregatedSnapshot[],
  field: keyof AggregatedSnapshot
): { time: string; delta: number }[] {
  const result: { time: string; delta: number }[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1][field]
    const curr = snapshots[i][field]
    if (typeof prev === 'number' && typeof curr === 'number') {
      result.push({ time: snapshots[i].poll_batch_ts, delta: Math.max(0, curr - prev) })
    }
  }
  return result
}
