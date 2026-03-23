// Source metadata comes from the data-node API.
//
// Client components  → useSourceRegistry()   from @/hooks/vision/useSourceRegistry
// Server components  → getSourceRegistryServer() from @/lib/vision/sources-server
//
// This file keeps shared types, the display→internal ID mapping, and a few
// utility functions that still have callers.

import { allInternalIds } from '@/lib/vision/source-ids'

export type SourceCategory = string

export interface VisionSource {
  id: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
}

/** @deprecated Use meta.assetCounts from useMarketSnapshotMeta() */
export function getAssetCountForSource(
  sourceId: string,
  assetCounts: Record<string, number>,
): number {
  // Try display ID first
  if (assetCounts[sourceId]) return assetCounts[sourceId]
  // Resolve internal IDs — sum all (covers multi-internal sources like "sec")
  let total = 0
  for (const iid of allInternalIds(sourceId)) {
    total += assetCounts[iid] ?? 0
  }
  return total
}

/** @deprecated Use meta.sources from useMarketSnapshotMeta() */
export function getSourceStatusFromMeta(
  sourceId: string,
  sources: Array<{ sourceId: string; status: string }>,
): string {
  // Try display ID first, then resolve all internal IDs (data-node uses internal IDs)
  const direct = sources.find(x => x.sourceId === sourceId)
  if (direct) return direct.status
  for (const iid of allInternalIds(sourceId)) {
    const s = sources.find(x => x.sourceId === iid)
    if (s) return s.status
  }
  return 'unknown'
}

/** @deprecated Use useSourceRegistry() hook */
export function getSourceForMarket(_marketId: string): VisionSource | undefined {
  return undefined
}
