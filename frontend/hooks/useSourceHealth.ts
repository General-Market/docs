'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

// ── Types ──

export type SourceStatus = 'healthy' | 'stale' | 'dead' | 'not_started' | 'initializing'

export interface SourceHealth {
  sourceId: string
  displayName: string
  syncIntervalSecs: number
  status: SourceStatus
  totalAssets: number
  activeAssets: number
  totalPriceRecords: number
  oldestRecord: string | null
  newestRecord: string | null
  lastSyncAgeSecs: number
  recordsLast1h: number
  recordsLast24h: number
  recordsLast7d: number
  zeroValueAssets: number
  staleAssets: number
  avgChangePct: number
  assetsWithNoChange24h: number
  syncGapMaxSecs: number
  estimatedDailyRecords: number
  // Error tracker fields
  errorCategory: string
  consecutiveErrors: number
  totalErrors: number
  lastError: string | null
  lastSuccessAt: string | null
  totalSyncs: number
  notStartedReason: string | null
}

interface SourceHealthResponse {
  generatedAt: string
  sources: Array<SourceHealth & { status: string }>
}

export interface UseSourceHealthReturn {
  sources: SourceHealth[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

function transformSource(raw: SourceHealthResponse['sources'][0]): SourceHealth {
  return {
    ...raw,
    status: raw.status as SourceStatus,
    lastError: raw.lastError ?? null,
    lastSuccessAt: raw.lastSuccessAt ?? null,
    notStartedReason: raw.notStartedReason ?? null,
  }
}

// ── Hook ──

const POLL_INTERVAL_MS = 30_000

export function useSourceHealth(): UseSourceHealthReturn {
  const [sources, setSources] = useState<SourceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${DATA_NODE_URL}/admin/sources/health`, {
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: SourceHealthResponse = await response.json()
      setSources(data.sources.map(transformSource))
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch source health')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refresh])

  return { sources, loading, error, lastUpdated, refresh }
}
