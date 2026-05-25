'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'

export interface HistoryPoint {
  ts: number
  value: number
}

interface RawPoint {
  fetched_at?: string
  fetchedAt?: string
  value?: string | number
}

/**
 * One fetch for the whole grid. The 10 curated assets' 24h history come back
 * as a Map<assetId, HistoryPoint[]> so the page can gate on a single loading
 * flag instead of waiting on ten independent requests.
 */
export function useBulkMarketHistory(
  sourceId: string,
  assetIds: string[],
  lookbackMs: number = 24 * 60 * 60 * 1000,
) {
  const sortedKey = [...assetIds].sort().join(',')
  return useQuery<Map<string, HistoryPoint[]>>({
    queryKey: ['market-history-bulk', sourceId, sortedKey, lookbackMs],
    enabled: assetIds.length > 0,
    queryFn: async () => {
      const to = new Date()
      const from = new Date(to.getTime() - lookbackMs)
      const params = new URLSearchParams({
        source: sourceId,
        assets: assetIds.join(','),
        from: from.toISOString(),
        to: to.toISOString(),
      })
      const res = await fetch(`/api/market/history-bulk?${params}`, {
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: { data?: Record<string, RawPoint[]> } = await res.json()
      const grouped = json.data ?? {}
      const out = new Map<string, HistoryPoint[]>()
      for (const id of assetIds) {
        const raw = grouped[id] ?? []
        const points: HistoryPoint[] = raw
          .map((p) => ({
            ts: (p.fetched_at ?? p.fetchedAt)
              ? new Date(p.fetched_at ?? p.fetchedAt!).getTime()
              : 0,
            value:
              typeof p.value === 'string'
                ? parseFloat(p.value)
                : typeof p.value === 'number'
                  ? p.value
                  : NaN,
          }))
          .filter((p) => isFinite(p.value) && p.ts > 0)
          .sort((a, b) => a.ts - b.ts)
        out.set(id, points)
      }
      return out
    },
    // 24h sparklines move slowly. Hold the result for 5 min and let the
    // user refresh by navigating away and back — polling every 60s was
    // hammering an endpoint that already struggles on big-defi sources.
    staleTime: 5 * 60_000,
    // When the asset set changes at a round transition, keep the previous map
    // on screen while the new one loads. Cards that persist into the new round
    // hold their sparkline (no flash); only genuinely-new assets fall back to
    // their own loading shimmer. This is what makes the swap smooth.
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
