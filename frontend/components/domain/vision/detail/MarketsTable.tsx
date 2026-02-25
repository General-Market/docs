'use client'

import { useState, useMemo } from 'react'
import { useMarketSnapshot } from '@/hooks/vision/useMarketSnapshot'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { getSource } from '@/lib/vision/sources'
import type { BitmapEditor, CellState } from '@/hooks/vision/useBitmapEditor'
import { ConsensusPopup } from './ConsensusPopup'

interface MarketsTableProps {
  sourceId: string
  bitmapEditor: BitmapEditor
}

function formatPrice(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  if (num >= 0.01) return `$${num.toFixed(4)}`
  return `$${num.toFixed(6)}`
}

function formatChangePct(pct: string | null): { text: string; color: string } {
  if (!pct) return { text: '--', color: 'text-text-muted' }
  const num = parseFloat(pct)
  if (isNaN(num)) return { text: '--', color: 'text-text-muted' }
  const sign = num >= 0 ? '+' : ''
  const color = num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : 'text-text-muted'
  return { text: `${sign}${num.toFixed(2)}%`, color }
}

function formatVolume(vol: string | null): string {
  if (!vol) return ''
  const num = parseFloat(vol)
  if (isNaN(num) || num === 0) return ''
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}

export function MarketsTable({ sourceId, bitmapEditor }: MarketsTableProps) {
  const { data, isLoading } = useMarketSnapshot()
  const [search, setSearch] = useState('')
  const [consensusOpen, setConsensusOpen] = useState<string | null>(null)

  const source = getSource(sourceId)
  const prefixes = source?.prefixes ?? []

  // Filter snapshot prices to this source's prefixes
  const sourceMarkets: SnapshotPrice[] = useMemo(() => {
    if (!data?.prices || prefixes.length === 0) return []
    return data.prices.filter((p) => {
      const id = p.assetId.toLowerCase()
      return prefixes.some((prefix) => id.startsWith(prefix))
    })
  }, [data?.prices, prefixes])

  // Apply search filter
  const filteredMarkets = useMemo(() => {
    if (!search.trim()) return sourceMarkets
    const q = search.toLowerCase()
    return sourceMarkets.filter(
      (m) =>
        m.symbol.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
    )
  }, [sourceMarkets, search])

  const getBetState = (marketId: string): CellState => {
    return bitmapEditor.state[marketId] ?? 'empty'
  }

  const handleBet = (marketId: string, direction: 'up' | 'down') => {
    const current = getBetState(marketId)
    // If already set to this direction, clear it
    if (current === direction) {
      bitmapEditor.setCell(marketId, 'empty')
    } else {
      bitmapEditor.setCell(marketId, direction)
    }
  }

  return (
    <div>
      {/* Markets bar */}
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Markets</div>
          <div className="section-bar-value">
            {isLoading ? '...' : sourceMarkets.length}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded text-[12px] bg-white/10 border border-white/20 text-white placeholder:text-white/40 outline-none focus:border-white/50 w-[180px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-t-0 border-border-light rounded-b-lg overflow-x-auto">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] items-center px-4 py-2.5 border-b-[3px] border-black text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
          <div>Name</div>
          <div className="text-right">Price</div>
          <div className="text-right">1d</div>
          <div className="text-right">7d</div>
          <div className="text-center">Consensus</div>
          <div className="text-center">Bet</div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            Loading markets...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredMarkets.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            {search ? 'No markets match your search' : 'No markets available'}
          </div>
        )}

        {/* Market rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {filteredMarkets.map((market) => {
            const change1d = formatChangePct(market.changePct)
            // Use changePct as proxy for 7d since we only have 1d data
            const change7d = formatChangePct(null)
            const vol = formatVolume(market.volume24h)
            const betState = getBetState(market.assetId)

            return (
              <div
                key={market.assetId}
                className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] items-center px-4 py-2.5 border-b border-border-light hover:bg-surface/50 transition-colors text-[13px]"
              >
                {/* Name */}
                <div className="min-w-0">
                  <div className="font-semibold text-black truncate">
                    {market.symbol}
                  </div>
                  {vol && (
                    <div className="text-[10px] font-mono text-text-muted mt-0.5">
                      Vol {vol}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="text-right font-mono tabular-nums text-black font-semibold">
                  {formatPrice(market.value)}
                </div>

                {/* 1d change */}
                <div className={`text-right font-mono tabular-nums font-semibold ${change1d.color}`}>
                  {change1d.text}
                </div>

                {/* 7d change */}
                <div className={`text-right font-mono tabular-nums font-semibold ${change7d.color}`}>
                  {change7d.text}
                </div>

                {/* Consensus */}
                <div className="text-center relative">
                  <button
                    onClick={() =>
                      setConsensusOpen(
                        consensusOpen === market.assetId ? null : market.assetId
                      )
                    }
                    className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold hover:bg-surface transition-colors cursor-pointer"
                  >
                    &mdash;
                  </button>
                  {consensusOpen === market.assetId && (
                    <ConsensusPopup
                      marketId={market.assetId}
                      onClose={() => setConsensusOpen(null)}
                    />
                  )}
                </div>

                {/* Bet UP/DN */}
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => handleBet(market.assetId, 'up')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                      betState === 'up'
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    UP
                  </button>
                  <button
                    onClick={() => handleBet(market.assetId, 'down')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                      betState === 'down'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    DN
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
