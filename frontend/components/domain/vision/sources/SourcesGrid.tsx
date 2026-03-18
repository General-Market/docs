'use client'

import { useState, useMemo } from 'react'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { getAssetCountForSource, getSourceStatusFromMeta } from '@/lib/vision/sources'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { CategoryNav } from './CategoryNav'
import { NextBatches } from './NextBatches'
import { SourceCard } from './SourceCard'

export function SourcesGrid() {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showSectionBar, setShowSectionBar] = useState(true)

  const { sources: registrySources, isLoading: registryLoading } = useSourceRegistry()
  const { data: meta, isLoading: metaLoading } = useMarketSnapshotMeta()
  const bitmapEditor = useBitmapEditor()

  // Filter sources by category, then exclude non-working sources
  const filteredSources = useMemo(() => {
    const byCategory = activeCategory === 'all'
      ? registrySources
      : registrySources.filter(s => s.category === activeCategory)

    if (!meta?.sources) return byCategory
    return byCategory.filter(source => {
      const status = getSourceStatusFromMeta(source.sourceId, meta.sources)
      if (status === 'healthy' || status === 'stale') return true
      const assetCount = meta.assetCounts?.[source.sourceId] ?? 0
      return assetCount > 0
    })
  }, [activeCategory, registrySources, meta?.sources, meta?.assetCounts])

  // Dynamic stats from live meta endpoint, with registry fallbacks
  const liveSourceCount = meta?.totalSources ?? 0
  const liveCategoryCount = meta?.totalCategories ?? 0
  const liveAssetCount = meta?.totalAssets ?? 0

  const sourceCount = liveSourceCount > 0 ? liveSourceCount : registrySources.length
  const categoryCount = liveCategoryCount > 0 ? liveCategoryCount : 10
  const statsLoading = (metaLoading || registryLoading) && liveAssetCount === 0

  return (
    <div className="flex flex-col">
      {/* Category navigation — filter-pill style */}
      <CategoryNav activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      {/* Next batches horizontal scroll */}
      <NextBatches />

      {/* Stats bar — full-bleed black, iShares convention: number dominates, label whispers */}
      {showSectionBar && (
        <div className="bg-black text-white">
          <div className="max-w-site mx-auto px-6 lg:px-12 py-5 flex items-end">
            <div className="flex items-end gap-10">
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/35 mb-1">Sources</span>
                <AnimatedNumber value={sourceCount} decimals={0} duration={1200} className="text-stat font-black font-mono tabular-nums" />
              </div>
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/35 mb-1">Assets</span>
                {statsLoading ? (
                  <span className="inline-block w-20 h-8 bg-white/10 rounded animate-pulse" />
                ) : (
                  <AnimatedNumber
                    value={liveAssetCount}
                    decimals={0}
                    duration={1600}
                    className="text-stat font-black font-mono tabular-nums"
                    formatFn={(v) => v > 0 ? Math.round(v).toLocaleString() : '—'}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/35 mb-1">Categories</span>
                <AnimatedNumber value={categoryCount} decimals={0} duration={1000} className="text-stat font-black font-mono tabular-nums" />
              </div>
            </div>

            {/* Live uptime — right aligned, quieter */}
            <div className="ml-auto flex items-center gap-3 live-ambient-pulse">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-label font-semibold text-green-400 uppercase">Live</span>
              </div>
              <span className="text-label font-mono font-bold text-white/50 tabular-nums">99.99%</span>
              <button
                onClick={() => setShowSectionBar(false)}
                className="text-white/30 hover:text-white transition-colors text-title leading-none ml-1"
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
            {filteredSources.map((source, i) => (
              <div key={source.sourceId} style={{ '--d': Math.floor(i / 4) + (i % 4) } as React.CSSProperties}>
                <SourceCard
                  source={{ ...source, id: source.sourceId }}
                  bitmapEditor={bitmapEditor}
                  metaAssetCount={meta?.assetCounts ? getAssetCountForSource(source.sourceId, meta.assetCounts) : undefined}
                  metaStatus={meta?.sources ? getSourceStatusFromMeta(source.sourceId, meta.sources) : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
