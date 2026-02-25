'use client'

import { useState, useMemo } from 'react'
import type { SourceCategory, VisionSource } from '@/lib/vision/sources'
import { VISION_SOURCES } from '@/lib/vision/sources'
import { getSourcesByCategory } from '@/lib/vision/source-categories'
import { SOURCE_CATEGORIES } from '@/lib/vision/source-categories'
import { useMarketSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { CategoryNav } from './CategoryNav'
import { NextBatches } from './NextBatches'
import { SourceCard } from './SourceCard'

/**
 * Groups snapshot prices by source, producing a map of sourceId -> market list.
 * Matches each price's assetId against source prefixes.
 */
function groupMarketsBySource(
  prices: { assetId: string; symbol: string }[] | undefined,
  sources: VisionSource[],
): Record<string, { id: string; symbol: string }[]> {
  const result: Record<string, { id: string; symbol: string }[]> = {}

  // Initialize all sources with empty arrays
  for (const src of sources) {
    result[src.id] = []
  }

  if (!prices) return result

  for (const p of prices) {
    const lower = p.assetId.toLowerCase()
    for (const src of sources) {
      if (src.prefixes.some(pfx => lower.startsWith(pfx))) {
        result[src.id].push({ id: p.assetId, symbol: p.symbol })
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


  const totalMarkets = snapshot?.totalAssets ?? 0
  const totalPrices = snapshot?.prices?.length ?? 0
  const sourceCount = VISION_SOURCES.length
  const categoryCount = SOURCE_CATEGORIES.length
  const marketDisplay = totalMarkets > 0
    ? totalMarkets.toLocaleString()
    : totalPrices > 0
    ? totalPrices.toLocaleString()
    : '30,000+'

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
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-black">24/7</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Live Sync</span>
                </div>
              </div>
              <button
                onClick={() => setShowSectionBar(false)}
                className="ml-auto text-white/40 hover:text-white transition-colors text-[18px] leading-none"
                aria-label="Dismiss"
              >
                &times;
              </button>
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
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
