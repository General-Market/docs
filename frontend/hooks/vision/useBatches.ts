import { useQuery } from '@tanstack/react-query'
import { keccak256, toHex } from 'viem'

// Build hash→name lookup from sources-display.json internalIds
// The oracle returns sourceId as keccak256(name + "_v2") but the frontend uses plain names
const _hashToName: Record<string, string> = {}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sourcesData = require('@/data/sources-display.json')
  for (const source of sourcesData.sources ?? []) {
    for (const iid of source.internalIds ?? []) {
      // Try multiple version suffixes
      for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
        const versioned = iid + suffix
        const hash = keccak256(toHex(versioned)).toLowerCase()
        _hashToName[hash] = source.sourceId
      }
    }
  }
} catch { /* sources not available at build time */ }

function resolveSourceId(rawSourceId: string): string {
  if (!rawSourceId.startsWith('0x')) return rawSourceId
  return _hashToName[rawSourceId.toLowerCase()] ?? rawSourceId
}

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
        sourceId: resolveSourceId(b.source_id ?? b.sourceId ?? ''),
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
    refetchInterval: 10000,
  })
}
