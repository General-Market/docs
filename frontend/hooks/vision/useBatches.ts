import { useQuery } from '@tanstack/react-query'

export interface BatchInfo {
  id: number
  creator: string
  sourceId: string
  configHash: string
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
    queryKey: ['vision-batches'],
    queryFn: async () => {
      const res = await fetch('/api/vision/batches')
      if (!res.ok) return []
      const data = await res.json()
      // API returns { batches: [...] } with snake_case fields
      const raw: any[] = data.batches ?? (Array.isArray(data) ? data : [])
      const all = raw.map((b: any) => ({
        id: b.id,
        creator: b.creator ?? '',
        sourceId: b.source_id ?? b.sourceId ?? '',
        configHash: b.config_hash ?? b.configHash ?? '',
        marketIds: b.market_ids ?? b.marketIds ?? [],
        resolutionTypes: b.resolution_types ?? b.resolutionTypes ?? [],
        tickDuration: b.tick_duration ?? b.tickDuration ?? 0,
        marketCount: b.market_count ?? b.marketCount ?? (b.market_ids ?? b.marketIds ?? []).length,
        playerCount: b.player_count ?? b.playerCount ?? 0,
        tvl: b.tvl ?? '0',
        currentTick: b.current_tick ?? b.currentTick ?? 0,
        paused: b.paused ?? false,
      }))
      // Deduplicate: keep only the LATEST active batch per source (highest ID = most recent round)
      const bySource = new Map<string, BatchInfo>()
      for (const b of all.filter(x => !x.paused).sort((a, z) => z.id - a.id)) {
        if (!bySource.has(b.sourceId)) bySource.set(b.sourceId, b)
      }
      return Array.from(bySource.values())
    },
    refetchInterval: 30_000,
  })
}
