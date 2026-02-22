'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

// ── Types ──

export type SourceStatus = 'healthy' | 'stale' | 'dead'

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
}

interface SourceHealthResponse {
  generated_at: string
  sources: Array<{
    source_id: string
    display_name: string
    sync_interval_secs: number
    status: string
    total_assets: number
    active_assets: number
    total_price_records: number
    oldest_record: string | null
    newest_record: string | null
    last_sync_age_secs: number
    records_last_1h: number
    records_last_24h: number
    records_last_7d: number
    zero_value_assets: number
    stale_assets: number
    avg_change_pct: number
    assets_with_no_change_24h: number
    sync_gap_max_secs: number
    estimated_daily_records: number
  }>
}

export interface UseSourceHealthReturn {
  sources: SourceHealth[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

// ── Transform snake_case response to camelCase ──

function transformSource(raw: SourceHealthResponse['sources'][0]): SourceHealth {
  return {
    sourceId: raw.source_id,
    displayName: raw.display_name,
    syncIntervalSecs: raw.sync_interval_secs,
    status: raw.status as SourceStatus,
    totalAssets: raw.total_assets,
    activeAssets: raw.active_assets,
    totalPriceRecords: raw.total_price_records,
    oldestRecord: raw.oldest_record,
    newestRecord: raw.newest_record,
    lastSyncAgeSecs: raw.last_sync_age_secs,
    recordsLast1h: raw.records_last_1h,
    recordsLast24h: raw.records_last_24h,
    recordsLast7d: raw.records_last_7d,
    zeroValueAssets: raw.zero_value_assets,
    staleAssets: raw.stale_assets,
    avgChangePct: raw.avg_change_pct,
    assetsWithNoChange24h: raw.assets_with_no_change_24h,
    syncGapMaxSecs: raw.sync_gap_max_secs,
    estimatedDailyRecords: raw.estimated_daily_records,
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
