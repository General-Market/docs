'use client'

import { memo } from 'react'

export interface AssetAgg {
  assetId: string
  fillsCount: number
  totalVolume: number
  avgEntry: number | null
  realizedPnl: number
  unrealizedPnl: number | null
  lastFillAt: string | null
  trend: 'up' | 'down' | 'flat'
}

interface Props {
  asset: AssetAgg
  selected: boolean
  onClick: () => void
}

function formatPnl(v: number): string {
  const sign = v >= 0 ? '+' : ''
  if (Math.abs(v) >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${sign}$${(v / 1_000).toFixed(2)}K`
  return `${sign}$${v.toFixed(2)}`
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

function formatEntry(v: number | null): string {
  if (v === null) return '—'
  return `$${v.toFixed(4)}`
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const delta = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(delta / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TrendPill = memo(({ trend }: { trend: 'up' | 'down' | 'flat' }) => {
  if (trend === 'up')
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: '#f0fdf4', color: '#16a34a' }}
      >
        ↗
      </span>
    )
  if (trend === 'down')
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: '#fef2f2', color: '#dc2626' }}
      >
        ↘
      </span>
    )
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: '#f5f5f7', color: '#6e6e73' }}
    >
      —
    </span>
  )
})
TrendPill.displayName = 'TrendPill'

export const VaultAssetRow = memo(({ asset, selected, onClick }: Props) => {
  const pnlPositive = asset.realizedPnl >= 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors hover:bg-[var(--apple-surface,#f5f5f7)] focus-visible:outline-none"
      style={{
        borderBottom: '1px solid var(--apple-divider, #e8e8ed)',
        background: selected ? 'var(--apple-surface, #f5f5f7)' : undefined,
        fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)',
      }}
    >
      {/* Market name */}
      <div className="flex-1 min-w-0">
        <div
          className="truncate font-medium text-[var(--apple-text,#1d1d1f)]"
          style={{ fontSize: 15, letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
          title={asset.assetId}
        >
          {asset.assetId}
        </div>
        <div
          className="text-[var(--apple-text-secondary,#6e6e73)] mt-0.5"
          style={{ fontSize: 13, letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
        >
          {asset.fillsCount} {asset.fillsCount === 1 ? 'fill' : 'fills'} · {relativeTime(asset.lastFillAt)}
        </div>
      </div>

      {/* Volume */}
      <div className="hidden sm:block w-24 text-right shrink-0">
        <div
          className="text-[var(--apple-text,#1d1d1f)]"
          style={{ fontSize: 14, letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
        >
          {formatVolume(asset.totalVolume)}
        </div>
        <div
          className="text-[var(--apple-text-secondary,#6e6e73)]"
          style={{ fontSize: 12 }}
        >
          volume
        </div>
      </div>

      {/* Avg entry */}
      <div className="hidden md:block w-24 text-right shrink-0">
        <div
          className="text-[var(--apple-text,#1d1d1f)]"
          style={{ fontSize: 14, letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
        >
          {formatEntry(asset.avgEntry)}
        </div>
        <div
          className="text-[var(--apple-text-secondary,#6e6e73)]"
          style={{ fontSize: 12 }}
        >
          avg entry
        </div>
      </div>

      {/* Realized PnL */}
      <div className="w-28 text-right shrink-0">
        <div
          className="font-medium"
          style={{
            fontSize: 14,
            letterSpacing: 'var(--apple-track-tight,-0.022em)',
            color: pnlPositive ? '#16a34a' : '#dc2626',
          }}
        >
          {formatPnl(asset.realizedPnl)}
        </div>
        <div
          className="text-[var(--apple-text-secondary,#6e6e73)]"
          style={{ fontSize: 12 }}
        >
          realized
        </div>
      </div>

      {/* Trend pill */}
      <div className="w-8 flex justify-end shrink-0">
        <TrendPill trend={asset.trend} />
      </div>

      {/* Chevron */}
      <div
        className="w-4 shrink-0"
        style={{ color: 'var(--apple-text-secondary,#6e6e73)', fontSize: 14 }}
        aria-hidden
      >
        {selected ? '▾' : '›'}
      </div>
    </button>
  )
})
VaultAssetRow.displayName = 'VaultAssetRow'
