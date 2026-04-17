'use client'

import { useCallback } from 'react'
import { NavSparkline } from '@/components/ui/NavSparkline'
import { SpringCard } from '@/components/ui/spring'

interface ItpBrowserCardProps {
  itpId: string
  name: string
  symbol: string
  navPerShare: number
  aum: number
  description?: string
  categoryLabel?: string
  isCommunity?: boolean
  onBuy: (itpId: string) => void
  onSell: (itpId: string) => void
  onNavigate: (itpId: string) => void
  index?: number
}

function formatNav(nav: number): string {
  if (nav >= 100) return `$${nav.toFixed(2)}`
  if (nav >= 1) return `$${nav.toFixed(4)}`
  return `$${nav.toFixed(6)}`
}

function formatAum(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`
  if (usd >= 0.01) return `$${usd.toFixed(2)}`
  return '—'
}

export function ItpBrowserCard({
  itpId, name, symbol, navPerShare, aum, description,
  categoryLabel, isCommunity,
  onBuy, onSell, onNavigate, index = 99,
}: ItpBrowserCardProps) {
  const handleBuy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onBuy(itpId)
  }, [itpId, onBuy])

  const handleSell = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSell(itpId)
  }, [itpId, onSell])

  return (
    <SpringCard className="bg-white border-r border-b border-border-light overflow-hidden aspect-square">
      <div
        onClick={() => onNavigate(itpId)}
        className="flex flex-col h-full group cursor-pointer"
      >
        {/* Sparkline area */}
        <div className="relative w-full bg-[#fafafa] overflow-hidden -mb-4 [&>div]:!rounded-none [&>div]:!border-0 [&>div]:!mb-0">
          <NavSparkline itpId={itpId} height={90} />
          {categoryLabel && (
            <span className="absolute top-2 right-2 text-micro font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded bg-black/[0.06] text-text-muted">
              {categoryLabel}
            </span>
          )}
        </div>

        {/* Card content */}
        <div className="flex flex-col flex-1 px-3 pt-2.5 pb-3 sm:px-4 sm:pt-3 sm:pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-body font-extrabold text-black tracking-tight">{symbol}</span>
                {isCommunity && (
                  <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#7c6f3e] bg-[#f5f0e0] px-1 py-px rounded">
                    Community
                  </span>
                )}
              </div>
              <p className="text-label text-text-muted leading-snug mt-0.5 line-clamp-1">{name}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-body font-black font-mono tabular-nums text-black">{formatNav(navPerShare)}</div>
              <div className="text-micro text-text-muted font-mono tabular-nums">{formatAum(aum)}</div>
            </div>
          </div>

          {/* Description */}
          {description && (
            <p className="text-micro text-text-muted leading-relaxed mt-2 line-clamp-3 flex-1">{description}</p>
          )}

          {/* Trade buttons — pinned to bottom */}
          <div className="flex gap-2 mt-auto pt-2">
            <button
              onClick={handleBuy}
              className="flex-1 text-caption font-bold text-white bg-black rounded-md py-1.5 hover:bg-zinc-800 transition-colors"
            >
              Buy
            </button>
            <button
              onClick={handleSell}
              className="flex-1 text-caption font-bold text-black bg-transparent border border-zinc-300 rounded-md py-1.5 hover:bg-zinc-50 transition-colors"
            >
              Sell
            </button>
          </div>
        </div>
      </div>
    </SpringCard>
  )
}
