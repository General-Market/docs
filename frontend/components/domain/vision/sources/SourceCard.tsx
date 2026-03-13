'use client'

import { useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { VisionSource } from '@/lib/vision/sources'
import { getDataNodeSourceId } from '@/lib/vision/sources'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import type { BitmapEditor, CellState } from '@/hooks/vision/useBitmapEditor'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'

/** Max entries shown in the hover overlay */
const HOVER_LIST_CAP = 100

interface SourceCardProps {
  source: VisionSource
  bitmapEditor: BitmapEditor
  /** Accurate asset count from admin health (overrides markets.length for display) */
  metaAssetCount?: number
  /** Source status from admin health: healthy, stale, dead, etc. */
  metaStatus?: string
}

/** Format a timestamp as relative age (e.g. "2m ago", "1h ago") */
function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Default is 'up' — undefined state means up */
function getCellState(state: Record<string, CellState>, marketId: string): CellState {
  return state[marketId] ?? 'up'
}

/** Format a numeric value for compact display */
function formatValue(v: string, isPrice?: boolean, unit?: string): string {
  const n = parseFloat(v)
  if (isNaN(n)) return v
  const prefix = isPrice ? '$' : ''
  const suffix = !isPrice && unit ? ` ${unit}` : ''
  if (n >= 1_000_000_000) return `${prefix}${(n / 1_000_000_000).toFixed(1)}B${suffix}`
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K${suffix}`
  if (isPrice) {
    if (n >= 1) return `$${n.toFixed(2)}`
    if (n > 0) return `$${n.toFixed(4)}`
    return '$0'
  }
  if (n >= 1) return `${n.toFixed(1)}${suffix}`
  if (n > 0) return `${n.toFixed(2)}${suffix}`
  return `0${suffix}`
}

export function SourceCard({ source, bitmapEditor, metaAssetCount, metaStatus }: SourceCardProps) {
  // Fetch per-source data immediately on mount
  const dataNodeId = getDataNodeSourceId(source.id)
  const { data: sourceSnapshot, isLoading } = useSourceSnapshot(dataNodeId)

  // Derive sorted markets from lazy-loaded snapshot
  const sortedMarkets = useMemo(() => {
    if (!sourceSnapshot?.prices) return []
    return [...sourceSnapshot.prices]
      .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
      .slice(0, HOVER_LIST_CAP)
  }, [sourceSnapshot?.prices])

  const totalMarkets = sourceSnapshot?.prices?.length ?? 0
  const displayMarketCount = metaAssetCount ?? totalMarkets

  // Status from admin health, fall back to meta-based check
  const statusLabel = metaStatus === 'healthy' ? 'Live' : metaStatus === 'stale' ? 'Stale' : metaStatus === 'dead' ? 'Dead' : displayMarketCount > 0 ? 'Live' : 'Pending'
  const statusColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'bg-color-up' : metaStatus === 'stale' ? 'bg-yellow-500' : 'bg-text-muted'
  const statusTextColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'text-color-up' : metaStatus === 'stale' ? 'text-yellow-600' : 'text-text-muted'

  // Bitmap editor counts (from lazy-loaded data)
  const upCount = sortedMarkets.filter(m => getCellState(bitmapEditor.state, m.assetId) === 'up').length
  const downCount = sortedMarkets.filter(m => getCellState(bitmapEditor.state, m.assetId) === 'down').length
  const totalSet = upCount + downCount

  // Drag-paint state
  const paintRef = useRef<{ active: boolean; target: CellState }>({ active: false, target: 'up' })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, marketId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const current = getCellState(bitmapEditor.state, marketId)
      const next: CellState = current === 'up' ? 'down' : current === 'down' ? 'empty' : 'up'
      bitmapEditor.setCell(marketId, next)
      paintRef.current = { active: true, target: next }
    },
    [bitmapEditor],
  )

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, marketId: string) => {
      if (!paintRef.current.active) return
      e.preventDefault()
      bitmapEditor.setCell(marketId, paintRef.current.target)
    },
    [bitmapEditor],
  )

  const handleMouseUp = useCallback(() => {
    paintRef.current.active = false
  }, [])

  // Determine brand background style
  const brandStyle: React.CSSProperties = source.brandBg.startsWith('linear-gradient')
    ? { background: source.brandBg }
    : { backgroundColor: source.brandBg }

  // Hide card if source has no working data (covers meta-down scenario)
  if (!isLoading && totalMarkets === 0 && !metaAssetCount) return null

  return (
    <div
      data-testid="source-card"
      className="bg-white border-r border-b border-border-light overflow-hidden"
    >
      {/* Brand image area */}
      <Link href={`/source/${source.id}`} className="block">
        <div className="relative aspect-video w-full group cursor-pointer overflow-hidden">
          {/* Brand logo face */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-full"
            style={brandStyle}
          >
            <Image
              src={source.logo}
              alt={source.name}
              width={240}
              height={60}
              loading="lazy"
              className="max-h-[60px] max-w-[90%] object-contain"
            />
            <span className="absolute top-2.5 right-2.5 text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded bg-black/55 text-white/90 backdrop-blur-sm">
              {getCategoryLabel(source.category).toUpperCase()}
            </span>
          </div>

          {/* Market list overlay — rolls in from bottom on hover */}
          <div
            className="absolute inset-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0 bg-[var(--surface)] flex flex-col"
          >
            {sortedMarkets.length > 0 ? (
              <>
                {/* Header */}
                <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
                  <h4 className="text-[11px] font-bold text-[var(--foreground)] truncate">{source.name}</h4>
                  <span className="text-[10px] font-bold text-[#999] bg-white px-1.5 py-0.5 rounded">{totalMarkets}</span>
                </div>

                {/* Scrollable market entries sorted by $ */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div className="flex-1 overflow-y-auto" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  {sortedMarkets.map((m, i) => {
                    const cellState = getCellState(bitmapEditor.state, m.assetId)
                    const borderColor = cellState === 'up' ? 'border-l-[var(--up)]' : cellState === 'down' ? 'border-l-[var(--down)]' : 'border-l-transparent'
                    return (
                      <div
                        key={m.assetId}
                        className={`flex items-center justify-between px-2.5 py-[3px] border-l-2 ${borderColor} ${i % 2 === 0 ? 'bg-white/50' : ''} hover:bg-black/[0.03] cursor-pointer select-none`}
                        title={m.name || m.symbol}
                        onMouseDown={e => handleMouseDown(e, m.assetId)}
                        onMouseEnter={e => handleMouseEnter(e, m.assetId)}
                      >
                        <span className="text-[10px] text-[var(--foreground)] truncate mr-2 leading-tight">
                          {m.name || m.symbol}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[var(--foreground)] shrink-0 tabular-nums">
                          {formatValue(m.value, source.isPrice, source.valueUnit)}
                        </span>
                      </div>
                    )
                  })}
                  {totalMarkets > HOVER_LIST_CAP && (
                    <div className="px-2.5 py-1.5 text-center">
                      <span className="text-[10px] font-semibold text-[var(--foreground)]/60">
                        +{totalMarkets - HOVER_LIST_CAP} more
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-3 py-1 border-t border-[var(--border)] flex items-center gap-3 text-[10px] font-semibold shrink-0">
                  <span className="text-[var(--up)]">{upCount} UP</span>
                  <span className="text-[var(--down)]">{downCount} DN</span>
                  <span className="text-[#999]">{sortedMarkets.length - totalSet} —</span>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                {isLoading ? (
                  <div className="text-[11px] font-semibold text-text-muted animate-pulse">Loading...</div>
                ) : (
                  <div className="text-center px-4">
                    <div className="text-[11px] font-semibold text-text-muted">
                      {displayMarketCount > 0 ? `${displayMarketCount} assets` : 'No markets yet'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Card content */}
      <div className="px-5 pt-4 pb-0">
        <div className="flex justify-between items-start mb-1">
          <div className="min-w-0 flex-1 mr-2">
            <h3 className="text-[16px] font-extrabold text-black tracking-[-0.01em]">{source.name}</h3>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5 line-clamp-2">{source.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-[6px] h-[6px] rounded-full ${statusColor}`} />
            <span className={`text-[11px] font-semibold ${statusTextColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 border-t border-b border-border-light -mx-5 px-5 mt-3">
          <div className="py-2.5 pr-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Markets</div>
            <span className="text-[15px] font-bold text-black font-mono tabular-nums">{displayMarketCount || '—'}</span>
          </div>
          <div className="py-2.5 px-3 border-l border-border-light">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Type</div>
            <span className="text-[13px] font-bold text-black">{source.valueLabel}</span>
          </div>
          <div className="py-2.5 pl-3 border-l border-border-light">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Updated</div>
            <span className="text-[13px] font-bold text-black">{sourceSnapshot?.generatedAt ? formatAge(sourceSnapshot.generatedAt) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Action buttons — full bleed outside padding */}
      <div className="grid grid-cols-3 border-t border-border-light">
        <Link href={`/source/${source.id}`} className="py-2.5 text-center bg-[rgba(22,163,74,0.06)] hover:bg-[rgba(22,163,74,0.12)] transition-colors">
          <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-color-up">Markets</span>
        </Link>
        <Link href={`/source/${source.id}`} className="py-2.5 text-center border-l border-border-light hover:bg-[var(--surface)] transition-colors">
          <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-black">Batch</span>
        </Link>
        <Link href={`/source/${source.id}`} className="py-2.5 text-center border-l border-border-light hover:bg-[var(--surface)] transition-colors">
          <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-black">Details</span>
        </Link>
      </div>
    </div>
  )
}
