'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { getAssetCountForSource, getSourceStatusFromMeta } from '@/lib/vision/sources'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { CategoryNav } from './CategoryNav'
import { NextBatches } from './NextBatches'
import { SourceCard } from './SourceCard'

export function SourcesGrid() {
  const t = useTranslations('vision')
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

  // Compute uptime from source health statuses
  const uptimePercent = useMemo(() => {
    if (!meta?.sources || meta.sources.length === 0) return null
    const healthy = meta.sources.filter(s => s.status === 'healthy').length
    return ((healthy / meta.sources.length) * 100).toFixed(1)
  }, [meta?.sources])

  // ── Cascade entrance ──
  const gridRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const rectsRef = useRef<{ cx: number; cy: number }[]>([])
  const reducedMotion = useRef(false)

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion.current) return
    const grid = gridRef.current
    if (!grid) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).classList.add('cascade-revealed')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.05 },
    )
    for (const child of Array.from(grid.children)) io.observe(child)
    return () => io.disconnect()
  }, [filteredSources])

  // ── Cursor wake — brightness pulse near cursor ──
  const cacheRects = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    rectsRef.current = Array.from(grid.children).map(el => {
      const r = el.getBoundingClientRect()
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
    })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (reducedMotion.current) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const grid = gridRef.current
      if (!grid) return
      const children = grid.children
      const rects = rectsRef.current
      if (rects.length !== children.length) return
      for (let i = 0; i < children.length; i++) {
        const { cx, cy } = rects[i]
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
        const t = Math.max(0, 1 - dist / 300)
        const el = children[i].firstElementChild as HTMLElement | null
        if (!el) continue
        el.style.filter = t > 0.01 ? `brightness(${1 + t * 0.06})` : ''
      }
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const grid = gridRef.current
    if (!grid) return
    for (const child of Array.from(grid.children)) {
      const el = child.firstElementChild as HTMLElement | null
      if (el) el.style.filter = ''
    }
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

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
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/35 mb-1">{t('sources_grid.sources')}</span>
                <AnimatedNumber value={sourceCount} decimals={0} duration={1200} className="text-stat font-black font-mono tabular-nums" />
              </div>
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/35 mb-1">{t('sources_grid.assets')}</span>
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
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/35 mb-1">{t('sources_grid.categories')}</span>
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
                <span className="text-label font-semibold text-green-400 uppercase">{t('sources_grid.live')}</span>
              </div>
              <span className="text-label font-mono font-bold text-white/50 tabular-nums">
                {uptimePercent !== null ? `${uptimePercent}%` : '—'}
              </span>
              <button
                onClick={() => setShowSectionBar(false)}
                className="text-white/30 hover:text-white transition-colors text-title leading-none ml-1"
                aria-label={t('sources_grid.dismiss')}
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
          <div
            ref={gridRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border border-border-light"
            onMouseEnter={cacheRects}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {filteredSources.map((source, i) => (
              <div
                key={source.sourceId}
                className="source-card-cascade"
                style={{ '--d': Math.floor(i / 4) + (i % 4) } as React.CSSProperties}
              >
                <SourceCard
                  source={{ ...source, id: source.sourceId }}
                  bitmapEditor={bitmapEditor}
                  index={i}
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
