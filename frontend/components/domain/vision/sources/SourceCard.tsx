'use client'

import { useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { VisionSource } from '@/lib/vision/sources'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import type { BitmapEditor, CellState } from '@/hooks/vision/useBitmapEditor'
import type { SourceMarket } from './SourcesGrid'

interface SourceCardProps {
  source: VisionSource
  markets: SourceMarket[]
  bitmapEditor: BitmapEditor
  /** Accurate asset count from admin health (overrides markets.length for display) */
  metaAssetCount?: number
  /** Source status from admin health: healthy, stale, dead, etc. */
  metaStatus?: string
}

/** Default is 'up' — undefined state means up */
function getCellState(state: Record<string, CellState>, marketId: string): CellState {
  return state[marketId] ?? 'up'
}

export function SourceCard({ source, markets, bitmapEditor, metaAssetCount, metaStatus }: SourceCardProps) {
  // Use meta count for display (accurate), fall back to snapshot markets count
  const displayMarketCount = metaAssetCount ?? markets.length
  // Status from admin health, fall back to snapshot-based check
  const isLive = metaStatus ? metaStatus === 'healthy' || metaStatus === 'stale' : markets.length > 0
  const statusLabel = metaStatus === 'healthy' ? 'Live' : metaStatus === 'stale' ? 'Stale' : metaStatus === 'dead' ? 'Dead' : markets.length > 0 ? 'Live' : 'Pending'
  const statusColor = metaStatus === 'healthy' || (!metaStatus && markets.length > 0) ? 'bg-color-up' : metaStatus === 'stale' ? 'bg-yellow-500' : 'bg-text-muted'
  const statusTextColor = metaStatus === 'healthy' || (!metaStatus && markets.length > 0) ? 'text-color-up' : metaStatus === 'stale' ? 'text-yellow-600' : 'text-text-muted'
  // Counts with default-up logic
  const upCount = markets.filter(m => getCellState(bitmapEditor.state, m.id) === 'up').length
  const downCount = markets.filter(m => getCellState(bitmapEditor.state, m.id) === 'down').length
  const totalSet = upCount + downCount

  // Drag-paint state
  const paintRef = useRef<{ active: boolean; target: CellState }>({ active: false, target: 'up' })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, marketId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const current = getCellState(bitmapEditor.state, marketId)
      // Cycle: up → down → empty → up
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

  return (
    <div data-testid="source-card" className="bg-white border-r border-b border-border-light overflow-hidden">
      {/* Brand image area — replaces YouTube thumbnail */}
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
              className="max-h-[60px] max-w-[75%] object-contain"
            />
            <span className="absolute top-2.5 right-2.5 text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded bg-black/55 text-white/90 backdrop-blur-sm">
              {getCategoryLabel(source.category).toUpperCase()}
            </span>
          </div>

          {/* Bitmap overlay — rolls in from bottom on hover (only if markets exist) */}
          {markets.length > 0 ? (
            <div
              className="absolute inset-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0 bg-[var(--surface)] flex flex-col"
            >
              {/* Bitmap header */}
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[var(--foreground)] truncate">{source.name}</h4>
                <span className="text-[10px] font-bold text-[#999] bg-white px-1.5 py-0.5 rounded">{markets.length}</span>
              </div>

              {/* Bitmap cells — scrollable, drag-to-paint */}
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <div
                className="flex-1 overflow-y-auto px-2 py-1.5"
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className="bitmap-grid select-none">
                  {markets.map(m => {
                    const cellState = getCellState(bitmapEditor.state, m.id)
                    const cellClass =
                      cellState === 'up' ? 'b-up' : cellState === 'down' ? 'b-dn' : 'b-empty'
                    const label = m.symbol.length > 3 ? m.symbol.slice(0, 3) : m.symbol
                    return (
                      <div
                        key={m.id}
                        className={`bitmap-cell ${cellClass}`}
                        title={m.name || m.symbol}
                        onMouseDown={e => handleMouseDown(e, m.id)}
                        onMouseEnter={e => handleMouseEnter(e, m.id)}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bitmap footer */}
              <div className="px-3 py-1.5 border-t border-[var(--border)] flex items-center gap-3 text-[10px] font-semibold">
                <span className="text-[var(--up)]">{upCount} UP</span>
                <span className="text-[var(--down)]">{downCount} DN</span>
                <span className="text-[#999]">{markets.length - totalSet} unset</span>
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0 bg-[var(--surface)] flex flex-col items-center justify-center"
            >
              <div className="text-center px-4">
                <div className="text-[11px] font-semibold text-text-muted mb-1">
                  {displayMarketCount > 0 ? 'Loading markets...' : 'No markets yet'}
                </div>
                {displayMarketCount > 0 && (
                  <div className="text-[10px] text-[#999]">{displayMarketCount} assets available</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Card content — matches ITP card body */}
      <div className="px-5 py-4">
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

        {/* Metrics row — matches ITP .fund-metrics */}
        <div className="grid grid-cols-3 border-t border-b border-border-light -mx-5 px-5 mt-3">
          <div className="py-2.5 pr-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Markets</div>
            <span className="text-[15px] font-bold text-black font-mono tabular-nums">{displayMarketCount || '—'}</span>
          </div>
          <div className="py-2.5 px-3 border-l border-border-light">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Category</div>
            <span className="text-[13px] font-bold text-black">{getCategoryLabel(source.category)}</span>
          </div>
          <div className="py-2.5 pl-3 border-l border-border-light">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Bets Set</div>
            <span className="text-[15px] font-bold text-black font-mono tabular-nums">{totalSet}/{markets.length || displayMarketCount || '—'}</span>
          </div>
        </div>

        {/* Action buttons — same grid as metrics, aligned columns */}
        <div className="grid grid-cols-3 -mx-5 px-5">
          <Link href={`/source/${source.id}`} className="py-2.5 pr-3 bg-[rgba(22,163,74,0.06)] hover:bg-[rgba(22,163,74,0.12)] transition-colors">
            <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-color-up">Markets</span>
          </Link>
          <Link href={`/source/${source.id}`} className="py-2.5 px-3 border-l border-border-light hover:bg-[var(--surface)] transition-colors">
            <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-black">Batch</span>
          </Link>
          <Link href={`/source/${source.id}`} className="py-2.5 pl-3 border-l border-border-light hover:bg-[var(--surface)] transition-colors">
            <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-black">Details</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
