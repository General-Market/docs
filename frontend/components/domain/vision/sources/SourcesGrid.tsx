'use client'

import { useState, useMemo } from 'react'
import type { SourceCategory, VisionSource } from '@/lib/vision/sources'
import { VISION_SOURCES, getAssetCountForSource, getSourceStatusFromMeta, getDataNodeSourceIds } from '@/lib/vision/sources'
import { getSourcesByCategory } from '@/lib/vision/source-categories'
import { SOURCE_CATEGORIES } from '@/lib/vision/source-categories'
import { useMarketSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { CategoryNav } from './CategoryNav'
import { NextBatches } from './NextBatches'
import { SourceCard } from './SourceCard'

/**
 * Groups snapshot prices by source, producing a map of sourceId -> market list.
 * Matches on the price's `source` field (data-node source ID) using VISION_TO_DATANODE mapping,
 * with prefix fallback for any unmatched entries.
 */
export interface SourceMarket { id: string; symbol: string; name: string }

function groupMarketsBySource(
  prices: { assetId: string; symbol: string; name: string; source?: string }[] | undefined,
  sources: VisionSource[],
): Record<string, SourceMarket[]> {
  const result: Record<string, SourceMarket[]> = {}

  // Initialize all sources with empty arrays
  for (const src of sources) {
    result[src.id] = []
  }

  if (!prices) return result

  // Build reverse map: data-node source ID → vision source ID
  const dnToVision: Record<string, string> = {}
  for (const src of sources) {
    // Direct match: vision source id is also a valid data-node source id
    dnToVision[src.id] = src.id
    // Mapped aliases from VISION_TO_DATANODE
    const dnIds = getDataNodeSourceIds(src.id)
    for (const dnId of dnIds) {
      dnToVision[dnId] = src.id
    }
  }

  for (const p of prices) {
    // Primary: match on source field (reliable, no prefix guessing)
    if (p.source) {
      const visionId = dnToVision[p.source]
      if (visionId && result[visionId]) {
        result[visionId].push({ id: p.assetId, symbol: p.symbol, name: p.name })
        continue
      }
    }
    // Fallback: prefix matching on assetId
    const lower = p.assetId.toLowerCase()
    for (const src of sources) {
      if (src.prefixes.some(pfx => lower.startsWith(pfx))) {
        result[src.id].push({ id: p.assetId, symbol: p.symbol, name: p.name })
        break
      }
    }
  }

  return result
}

export function SourcesGrid() {
  const [activeCategory, setActiveCategory] = useState<SourceCategory | 'all'>('all')

  const [showSectionBar, setShowSectionBar] = useState(true)

  const { data: snapshot } = useMarketSnapshot()
  const { data: meta } = useMarketSnapshotMeta()
  const bitmapEditor = useBitmapEditor()

  // Group markets by source
  const marketsBySource = useMemo(
    () => groupMarketsBySource(snapshot?.prices, VISION_SOURCES),
    [snapshot?.prices],
  )

  // Filter sources by category
  const filteredSources = useMemo(
    () => getSourcesByCategory(activeCategory),
    [activeCategory],
  )


  // Dynamic stats from live meta endpoint, with static fallbacks
  const liveSourceCount = meta?.totalSources ?? 0
  const liveCategoryCount = meta?.totalCategories ?? 0
  const liveAssetCount = meta?.totalAssets ?? snapshot?.totalAssets ?? 0

  const sourceCount = liveSourceCount > 0 ? liveSourceCount : VISION_SOURCES.length
  const categoryCount = liveCategoryCount > 0 ? liveCategoryCount : SOURCE_CATEGORIES.length
  const marketDisplay = liveAssetCount > 0
    ? liveAssetCount.toLocaleString()
    : '—'

  return (
    <div className="flex flex-col">
      {/* Category navigation — filter-pill style */}
      <CategoryNav activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      {/* Next batches horizontal scroll */}
      <NextBatches />

      {/* Section bar — stats on black bar */}
      {showSectionBar && (
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto">
            <div className="bg-black text-white px-5 py-3 flex items-center">
              <div className="flex items-center gap-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-black">{sourceCount}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Sources</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-black">{marketDisplay}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Assets</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-black">{categoryCount}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Categories</span>
                </div>
              </div>

              {/* Live uptime indicator — right aligned */}
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-[12px] font-bold text-green-400 uppercase tracking-[0.04em]">Live</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '99.99%' }} />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-white/60">99.99%</span>
                </div>
                <button
                  onClick={() => setShowSectionBar(false)}
                  className="text-white/40 hover:text-white transition-colors text-[18px] leading-none ml-2"
                  aria-label="Dismiss"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid container */}
      <div className="px-6 lg:px-12 py-6">
        <div className="max-w-site mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border border-border-light">
            {filteredSources.map(source => (
              <SourceCard
                key={source.id}
                source={source}
                markets={marketsBySource[source.id] ?? []}
                bitmapEditor={bitmapEditor}
                metaAssetCount={meta?.assetCounts ? getAssetCountForSource(source.id, meta.assetCounts) : undefined}
                metaStatus={meta?.sources ? getSourceStatusFromMeta(source.id, meta.sources) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
