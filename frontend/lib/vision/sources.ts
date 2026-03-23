// All source metadata now comes from the data-node API.
//
// Client components  → useSourceRegistry()   from @/hooks/vision/useSourceRegistry
// Server components  → getSourceRegistryServer() from @/lib/vision/sources-server
//                      (also: getSourceDisplayServer, getSourceIdsServer, formatMarketNameServer)
//
// This file is kept for backward compatibility; the stubs below return empty/null.

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

// Empty — all data comes from API now
export const VISION_SOURCES: VisionSource[] = []

// ── Stub helpers kept for backward compatibility ──────────────────────────────
// These return empty/null so TypeScript doesn't error. Pages that need real
// data should use useSourceRegistry() hook instead.

/** @deprecated Use useSourceRegistry() hook */
export function getSource(_sourceId: string): VisionSource | undefined {
  return undefined
}

/** @deprecated Use useSourceRegistry() hook */
export function getSourceIds(): string[] {
  return []
}

/** @deprecated Use useSourceRegistry() hook */
export function getBatchKey(sourceId: string): string {
  return sourceId
}

/** Map display sourceIds → data-node internal IDs for API calls */
const DISPLAY_TO_INTERNAL: Record<string, string> = {
  coingecko: 'crypto',
  defillama: 'defi',
  finnhub: 'stocks',
  fred: 'rates',
  treasury: 'bonds',
  gtfs_rt: 'gtfs_transit',
  pandascore: 'esports',
}

export function getDataNodeSourceId(sourceId: string): string {
  return DISPLAY_TO_INTERNAL[sourceId] ?? sourceId
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

/** @deprecated Use source.valueLabel from useSourceRegistry() */
export function getSourceValueLabel(_sourceId: string): string {
  return 'Value'
}

/** @deprecated Use source.isPrice from useSourceRegistry() */
export function isSourcePriceType(_sourceId: string): boolean {
  return false
}

/** @deprecated Use source.valueUnit from useSourceRegistry() */
export function getSourceUnit(_sourceId: string): string {
  return ''
}

/** @deprecated Use useSourceRegistry() hook */
export function getVisionSourceId(sourceId: string): string {
  return sourceId
}

/** @deprecated Use useSourceRegistry() hook */
export function getSourceForMarket(_marketId: string): VisionSource | undefined {
  return undefined
}
