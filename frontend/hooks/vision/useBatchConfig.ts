import { useQuery } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface BatchConfigMarket {
  asset_id: string
  resolution_type: string
  threshold_bps: number
}

export interface BatchConfigResponse {
  sourceId: string
  configHash: string
  tickDurationSecs: number
  lockOffsetSecs: number
  markets: BatchConfigMarket[]
  createdAt?: string
}

/**
 * Fetch the authoritative market list for a batch by its pinned config_hash.
 * This is the source of truth — NOT the live snapshot, which can drift.
 */
export function useBatchConfig(configHash: string | undefined) {
  return useQuery<BatchConfigResponse>({
    queryKey: ['batch-config', configHash],
    enabled: !!configHash,
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/batches/config/${encodeURIComponent(configHash!)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60_000, // config is immutable per hash — cache aggressively
    gcTime: 30 * 60_000,
    retry: 2,
  })
}
