'use client'

import { useQuery } from '@tanstack/react-query'

export interface RoundInfo {
  batchId: number
  sourceId: string
  status: 'betting' | 'locked' | 'settling' | 'settled'
  playerCount: number
  tvl: string
  bettingEnd: string | null
  settledAt: string | null
  marketCount: number
  /** Tick duration in seconds — used for progress computation */
  timeframeSecs: number
}

export function useRounds(sourceId?: string) {
  return useQuery<RoundInfo[]>({
    queryKey: ['vision-rounds', sourceId],
    queryFn: async () => {
      const params = sourceId ? `?source=${sourceId}` : ''
      const res = await fetch(`/api/vision/rounds${params}`)
      if (!res.ok) return []
      const data = await res.json()
      const raw = Array.isArray(data.rounds) ? data.rounds : Array.isArray(data) ? data : []
      return raw
        .map((r: any) => ({
          batchId: r.batchId ?? r.batch_id ?? r.id,
          sourceId: r.sourceId ?? r.source_id ?? '',
          status: r.status ?? 'betting',
          playerCount: r.playerCount ?? r.player_count ?? 0,
          tvl: r.tvl ?? '0',
          bettingEnd: r.bettingEnd ?? r.betting_end ?? null,
          settledAt: r.settledAt ?? r.settled_at ?? null,
          marketCount: r.marketCount ?? r.market_count ?? 0,
          timeframeSecs: r.timeframeSecs ?? r.timeframe_secs ?? 0,
        }))
        // Keep all rounds — oracle already filters to non-paused (unsettled) only.
        // Settled batches have paused=true and won't appear in the API response.
    },
    refetchInterval: 5000,
  })
}
