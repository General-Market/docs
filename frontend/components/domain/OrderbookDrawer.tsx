'use client'

import { useState, useMemo } from 'react'
import type { OrderbookData, OrderbookLevel, AssetOrderbookSummary } from '@/hooks/useItpOrderbook'

// ── Aggregation options ──
const AGGREGATION_OPTIONS = [
  { label: 'Raw', value: 0 },
  { label: '0.01%', value: 1 },
  { label: '0.02%', value: 2 },
  { label: '0.05%', value: 5 },
  { label: '0.1%', value: 10 },
  { label: '0.25%', value: 25 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
  { label: '2%', value: 200 },
  { label: '5%', value: 500 },
] as const

// ── Formatting helpers ──

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatPrice(price: number): string {
  if (price >= 10_000) return price.toFixed(2)
  if (price >= 100) return price.toFixed(3)
  if (price >= 1) return price.toFixed(4)
  if (price >= 0.01) return price.toFixed(5)
  return price.toFixed(6)
}

function formatQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(1)}M`
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}K`
  if (qty >= 1) return qty.toFixed(2)
  return qty.toFixed(4)
}

// ── Spread badge color ──

function spreadColor(bps: number): string {
  if (bps < 10) return 'text-green-600 bg-green-500/10'
  if (bps < 50) return 'text-yellow-600 bg-yellow-500/10'
  return 'text-red-600 bg-red-500/10'
}

// ── Props ──

interface OrderbookDrawerProps {
  data: OrderbookData | null
  isLoading: boolean
  error: string | null
  aggregationBps: number
  onAggregationChange: (bps: number) => void
}

// ── Component ──

export function OrderbookDrawer({
  data,
  isLoading,
  error,
  aggregationBps,
  onAggregationChange,
}: OrderbookDrawerProps) {
  const [showAssets, setShowAssets] = useState(false)

  // Compute max depth for bar widths
  const maxDepth = useMemo(() => {
    if (!data) return 1
    const maxBid = data.bids.reduce((m, l) => Math.max(m, l.usd_value), 0)
    const maxAsk = data.asks.reduce((m, l) => Math.max(m, l.usd_value), 0)
    return Math.max(maxBid, maxAsk, 1)
  }, [data])

  // Asks reversed: highest to lowest (display top-to-bottom)
  const asksReversed = useMemo(() => {
    if (!data) return []
    return [...data.asks].reverse()
  }, [data])

  // Sorted per-asset by weight desc
  const sortedAssets = useMemo(() => {
    if (!data) return []
    return [...data.per_asset].sort((a, b) => b.weight_bps - a.weight_bps)
  }, [data])

  return (
    <div className="w-[280px] h-full bg-white border border-border-light flex flex-col text-[10px] font-mono select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border-light">
        <span className="text-[11px] font-bold text-black tracking-wide uppercase">Depth</span>
        {data && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${spreadColor(data.spread_bps)}`}>
            {data.spread_bps.toFixed(1)} bps
          </span>
        )}
        <select
          value={aggregationBps}
          onChange={e => onAggregationChange(Number(e.target.value))}
          className="border border-border-light rounded px-1 py-0.5 text-[9px] bg-white text-text-secondary cursor-pointer focus:outline-none"
        >
          {AGGREGATION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── Loading / Error / Empty states ── */}
      {error && !data && (
        <div className="flex-1 flex items-center justify-center text-red-500 text-[11px] px-2 text-center">
          {error}
        </div>
      )}
      {!error && !data && (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-[11px] gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            Loading depth...
          </div>
        </div>
      )}
      {!error && data && data.bids.length === 0 && data.asks.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-[11px] gap-3">
          {data.mid_price > 0 && (
            <div className="text-center">
              <div className="text-[14px] font-bold text-black">{formatPrice(data.mid_price)}</div>
              <div className="text-[9px] text-text-muted mt-0.5">{data.assets_included} assets priced</div>
            </div>
          )}
          <div className="text-[10px] text-text-muted">No orders</div>
        </div>
      )}

      {/* ── Orderbook body ── */}
      {data && data.bids.length > 0 && data.asks.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Column headers */}
          <div className="flex items-center px-2.5 py-1 text-[9px] text-text-muted uppercase tracking-wider border-b border-border-light">
            <span className="w-[45%]">Price</span>
            <span className="w-[25%] text-right">Size</span>
            <span className="w-[30%] text-right">Total</span>
          </div>

          {/* Asks (reversed) */}
          <div className="flex-1 overflow-y-auto flex flex-col justify-end">
            {asksReversed.map((level, i) => (
              <OrderbookRow
                key={`ask-${i}`}
                level={level}
                side="ask"
                maxDepth={maxDepth}
              />
            ))}
          </div>

          {/* Spread line */}
          <div className="flex items-center justify-between px-2.5 py-1 border-y border-dashed border-border-light bg-gray-50">
            <span className="text-[12px] font-bold text-black">{formatPrice(data.mid_price)}</span>
            <span className="text-[9px] text-text-muted">{data.spread_bps.toFixed(1)} bps</span>
          </div>

          {/* Bids */}
          <div className="flex-1 overflow-y-auto">
            {data.bids.map((level, i) => (
              <OrderbookRow
                key={`bid-${i}`}
                level={level}
                side="bid"
                maxDepth={maxDepth}
              />
            ))}
          </div>

          {/* ── Depth summary footer ── */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-border-light bg-gray-50 text-[9px]">
            <span className="text-green-600 font-semibold">Bid {formatUsd(data.total_bid_depth_usd)}</span>
            <span className="text-text-muted">
              {data.assets_included}/{data.assets_included + data.assets_failed.length} assets
            </span>
            <span className="text-red-600 font-semibold">Ask {formatUsd(data.total_ask_depth_usd)}</span>
          </div>

          {/* ── Per-asset breakdown (collapsible) ── */}
          <div className="border-t border-border-light">
            <button
              onClick={() => setShowAssets(!showAssets)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[9px] text-text-muted hover:text-text-primary transition-colors"
            >
              <span>Per-asset breakdown</span>
              <span>{showAssets ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showAssets && (
              <div className="max-h-[200px] overflow-y-auto">
                {sortedAssets.map(asset => (
                  <AssetRow key={asset.symbol} asset={asset} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── OrderbookRow ──

function OrderbookRow({
  level,
  side,
  maxDepth,
}: {
  level: OrderbookLevel
  side: 'bid' | 'ask'
  maxDepth: number
}) {
  const barWidth = (level.usd_value / maxDepth) * 100
  const isBid = side === 'bid'

  return (
    <div className="relative h-[18px] flex items-center px-2.5 hover:bg-gray-50/50">
      {/* Depth bar */}
      <div
        className={`absolute top-0 bottom-0 ${isBid ? 'left-0 bg-green-500/10' : 'right-0 bg-red-500/10'}`}
        style={{ width: `${barWidth}%` }}
      />
      {/* Content */}
      <span className={`relative w-[45%] ${isBid ? 'text-green-600' : 'text-red-600'}`}>
        {formatPrice(level.price)}
      </span>
      <span className={`relative w-[25%] text-right ${isBid ? 'text-green-600' : 'text-red-600'}`}>
        {formatQty(level.quantity)}
      </span>
      <span className="relative w-[30%] text-right text-text-secondary">
        {formatUsd(level.usd_value)}
      </span>
    </div>
  )
}

// ── AssetRow ──

function AssetRow({ asset }: { asset: AssetOrderbookSummary }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1 border-t border-border-light/50 text-[9px]">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-text-primary">{asset.symbol}</span>
        <span className="text-text-muted">{(asset.weight_bps / 100).toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`${spreadColor(asset.spread_bps)} px-1 py-0.5 rounded`}>
          {asset.spread_bps.toFixed(0)}bps
        </span>
        <span className="text-text-muted">{formatUsd(asset.bid_depth_usd + asset.ask_depth_usd)}</span>
      </div>
    </div>
  )
}
