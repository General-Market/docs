import { useQuery } from '@tanstack/react-query'
import { P2POOL_API_URL } from '@/lib/config'

export interface BatchInfo {
  id: number
  creator: string
  marketIds: string[]
  resolutionTypes: number[]
  tickDuration: number
  marketCount: number
  playerCount: number
  tvl: string
  currentTick: number
  paused: boolean
}

export function useBatches() {
  return useQuery<BatchInfo[]>({
    queryKey: ['p2pool-batches'],
    queryFn: async () => {
      const res = await fetch(`${P2POOL_API_URL}/p2pool/batches`)
      if (!res.ok) return []
      const data = await res.json()
      // API returns { batches: [...] } with snake_case fields
      const raw: any[] = data.batches ?? (Array.isArray(data) ? data : [])
      return raw.map((b: any) => ({
        id: b.id,
        creator: b.creator ?? '',
        marketIds: b.market_ids ?? b.marketIds ?? [],
        resolutionTypes: b.resolution_types ?? b.resolutionTypes ?? [],
        tickDuration: b.tick_duration ?? b.tickDuration ?? 0,
        marketCount: b.market_count ?? b.marketCount ?? (b.market_ids ?? b.marketIds ?? []).length,
        playerCount: b.player_count ?? b.playerCount ?? 0,
        tvl: b.tvl ?? '0',
        currentTick: b.current_tick ?? b.currentTick ?? 0,
        paused: b.paused ?? false,
      }))
    },
    refetchInterval: 10000,
  })
}
