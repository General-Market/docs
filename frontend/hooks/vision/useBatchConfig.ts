import { useQuery } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface BatchConfigMarket {
  assetId: string
  resolutionType: string
  thresholdBps: number
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

/**
 * Fetch the current batch config by source id. Same response shape as
 * useBatchConfig, but keyed on the stable source id instead of the on-chain
 * config hash. Two reasons to prefer this on curated subsource pages:
 *
 *  1. It matches the cache key the page-level SSR prefetch writes to, so the
 *     picker hydrates with markets on first paint instead of flashing 0/0.
 *  2. During round transitions the on-chain hash flips a few seconds before
 *     the data-node writes the new `batch_configs` row, and the hash endpoint
 *     404s in that gap. The source endpoint serves the current config straight
 *     from memory, no race.
 */
export function useBatchConfigBySource(sourceId: string | undefined) {
  return useQuery<BatchConfigResponse>({
    queryKey: ['batch-config-source', sourceId],
    enabled: !!sourceId,
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/batches/source/${encodeURIComponent(sourceId!)}/config`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
  })
}
