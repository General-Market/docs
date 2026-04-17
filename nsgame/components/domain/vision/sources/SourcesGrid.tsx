'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { allInternalIds } from '@/lib/vision/source-ids'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { CategoryNav } from './CategoryNav'
import { NextBatches } from './NextBatches'
import { SourceCard } from './SourceCard'
import { SourceCardsSkeleton } from '@/components/ui/VisionLoader'

/** How many cards to render on first paint (3 rows × 4 cols) */
const INITIAL_RENDER_COUNT = 12
/** Minimum cursor movement (px) before recalculating brightness */
const CURSOR_DEAD_ZONE = 4

function assetCountForSource(sourceId: string, assetCounts: Record<string, number>): number {
  if (assetCounts[sourceId]) return assetCounts[sourceId]
  let total = 0
  for (const iid of allInternalIds(sourceId)) {
    total += assetCounts[iid] ?? 0
  }
  return total
}

function sourceStatusFromMeta(
  sourceId: string,
  sources: Array<{ sourceId: string; status: string }>,
): string {
  const direct = sources.find(x => x.sourceId === sourceId)
  if (direct) return direct.status
  for (const iid of allInternalIds(sourceId)) {
    const s = sources.find(x => x.sourceId === iid)
    if (s) return s.status
  }
  return 'unknown'
}

export function SourcesGrid() {
  const t = useTranslations('vision')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showSectionBar, setShowSectionBar] = useState(true)

  const { sources: registrySources, isLoading: registryLoading } = useSourceRegistry()
  const { data: meta, isLoading: metaLoading } = useMarketSnapshotMeta()
  const bitmapEditor = useBitmapEditor()

  // Filter sources by category, then exclude stale/dead sources
  const filteredSources = useMemo(() => {
    const byCategory = activeCategory === 'all'
      ? registrySources
      : registrySources.filter(s => s.category === activeCategory)

    if (!meta?.sources) return byCategory
    return byCategory.filter(s => {
      const status = sourceStatusFromMeta(s.sourceId, meta.sources)
      return status !== 'stale' && status !== 'dead'
    })
  }, [activeCategory, registrySources, meta?.sources, meta?.assetCounts])

  // ── Progressive rendering, show first 12 immediately, rest after idle ──
  const [renderAll, setRenderAll] = useState(false)

  useEffect(() => {
    // Reset when filtered sources change (category switch)
    if (filteredSources.length <= INITIAL_RENDER_COUNT) {
      setRenderAll(true)
      return
    }
    setRenderAll(false)
    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 1)
    const id = schedule(() => setRenderAll(true))
    return () => {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(id as number)
      } else {
        clearTimeout(id as number)
      }
    }
  }, [filteredSources])

  const visibleSources = renderAll
    ? filteredSources
    : filteredSources.slice(0, INITIAL_RENDER_COUNT)

  // Stabilize source props, avoid creating { ...source, id } on every render.
  // Each source object from the registry already has sourceId; we add `id` once and cache.
  const stableSourceProps = useMemo(() => {
    const map = new Map<string, typeof filteredSources[0] & { id: string }>()
    for (const s of filteredSources) {
      map.set(s.sourceId, Object.assign(Object.create(null), s, { id: s.sourceId }))
    }
    return map
  }, [filteredSources])

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
  /** Last cursor position for dead-zone check */
  const lastCursorRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion.current) return
    const grid = gridRef.current
    if (!grid) return
    const io = new IntersectionObserver(
      (entries) => {
        let needsRectUpdate = false
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).classList.add('cascade-revealed')
            io.unobserve(entry.target)
            needsRectUpdate = true
          }
        })
        // Pre-populate rect cache as cards become visible, ready before mouseEnter
        if (needsRectUpdate) {
          cacheRects()
        }
      },
      { threshold: 0.05 },
    )
    for (const child of Array.from(grid.children)) io.observe(child)
    return () => io.disconnect()
  }, [filteredSources]) // eslint-disable-line react-hooks/exhaustive-deps, cacheRects is stable

  // ── Cursor wake, brightness pulse near cursor ──
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

    // Dead-zone: skip if cursor moved less than CURSOR_DEAD_ZONE px
    const dx = e.clientX - lastCursorRef.current.x
    const dy = e.clientY - lastCursorRef.current.y
    if (dx * dx + dy * dy < CURSOR_DEAD_ZONE * CURSOR_DEAD_ZONE) return
    lastCursorRef.current.x = e.clientX
    lastCursorRef.current.y = e.clientY

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const grid = gridRef.current
      if (!grid) return
      const children = grid.children
      const rects = rectsRef.current
      if (rects.length !== children.length) return
      const mx = e.clientX
      const my = e.clientY
      for (let i = 0; i < children.length; i++) {
        const { cx, cy } = rects[i]
        const dist = Math.hypot(mx - cx, my - cy)
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
      {/* Category navigation, filter-pill style */}
      <CategoryNav activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      {/* Next batches horizontal scroll */}
      <NextBatches />

      {/* Stats bar, full-bleed black, iShares convention: number dominates, label whispers */}
      {showSectionBar && (
        <div className="bg-black text-white">
          <div className="max-w-site mx-auto px-6 lg:px-12 py-5 flex items-end">
            <div className="flex items-end gap-10">
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/70 mb-1">{t('sources_grid.sources')}</span>
                <AnimatedNumber value={sourceCount} decimals={0} duration={1200} className="text-stat font-black font-mono tabular-nums" />
              </div>
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/70 mb-1">{t('sources_grid.assets')}</span>
                {statsLoading ? (
                  <span className="inline-block w-20 h-8 bg-white/10 rounded animate-pulse" />
                ) : (
                  <AnimatedNumber
                    value={liveAssetCount}
                    decimals={0}
                    duration={1600}
                    className="text-stat font-black font-mono tabular-nums"
                    formatFn={(v) => v > 0 ? Math.round(v).toLocaleString() : ', '}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-micro font-medium uppercase tracking-[0.08em] text-white/70 mb-1">{t('sources_grid.categories')}</span>
                <AnimatedNumber value={categoryCount} decimals={0} duration={1000} className="text-stat font-black font-mono tabular-nums" />
              </div>
            </div>

            {/* Live uptime, right aligned, links to explorer */}
            <div className="ml-auto flex items-center gap-3 live-ambient-pulse">
              <a href="/explorer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-up opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-color-up" />
                </span>
                <span className="text-label font-semibold text-color-up uppercase">{t('sources_grid.live')}</span>
                <span className="text-label font-mono font-bold text-white/70 tabular-nums">
                  {uptimePercent !== null ? `${uptimePercent}%` : ', '}
                </span>
              </a>
              <button
                onClick={() => setShowSectionBar(false)}
                className="text-white/60 hover:text-white transition-colors text-title leading-none ml-1"
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
          {registryLoading && filteredSources.length === 0 ? (
            <SourceCardsSkeleton />
          ) : (
          <div
            ref={gridRef}
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border border-border-light"
            onMouseEnter={cacheRects}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {visibleSources.map((source, i) => (
              <div
                key={source.sourceId}
                className="source-card-cascade"
                style={{ '--d': Math.floor(i / 4) + (i % 4) } as React.CSSProperties}
              >
                <SourceCard
                  source={stableSourceProps.get(source.sourceId)!}
                  bitmapEditor={bitmapEditor}
                  index={i}
                  metaAssetCount={meta?.assetCounts ? assetCountForSource(source.sourceId, meta.assetCounts) : undefined}
                  metaStatus={meta?.sources ? sourceStatusFromMeta(source.sourceId, meta.sources) : undefined}
                />
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
