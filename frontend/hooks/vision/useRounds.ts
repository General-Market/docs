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
}

export function useRounds(sourceId?: string) {
  return useQuery<RoundInfo[]>({
    queryKey: ['vision-rounds', sourceId],
    queryFn: async () => {
      const params = sourceId ? `?source=${sourceId}` : ''
      const res = await fetch(`/api/vision/rounds${params}`)
      if (!res.ok) return []
      const data = await res.json()
      const now = Date.now()
      return (data.rounds ?? [])
        .map((r: any) => ({
          batchId: r.batchId ?? r.batch_id ?? r.id,
          sourceId: r.sourceId ?? r.source_id ?? '',
          status: r.status ?? 'betting',
          playerCount: r.playerCount ?? r.player_count ?? 0,
          tvl: r.tvl ?? '0',
          bettingEnd: r.bettingEnd ?? r.betting_end ?? null,
          settledAt: r.settledAt ?? r.settled_at ?? null,
          marketCount: r.marketCount ?? r.market_count ?? 0,
        }))
        // Only keep rounds with future bettingEnd (or no bettingEnd set)
        .filter((r: RoundInfo) => {
          if (!r.bettingEnd) return true
          // Allow 2x tick grace period for settlement
          return new Date(r.bettingEnd).getTime() + 600_000 > now
        })
    },
    refetchInterval: 5000,
  })
}
