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
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
