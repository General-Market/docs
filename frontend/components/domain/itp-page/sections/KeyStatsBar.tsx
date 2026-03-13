'use client'

import { useItpNavSeries } from '@/hooks/useItpNavSeries'
import type { SectionProps } from '../SectionRenderer'

function asOfToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Skeleton() {
  return <div className="animate-pulse bg-gray-200 h-9 w-28 rounded" />
}

export function KeyStatsBar({ itpId, nav, aum, assetCount, sinceInception }: SectionProps) {
  const { data: dayData } = useItpNavSeries(itpId, '5m')

  let change1d: number | null = null
  let change1dAbs: number | null = null
  if (dayData.length > 0 && nav > 0) {
    const openNav = dayData[0].open
    if (openNav > 0) {
      change1d = ((nav - openNav) / openNav) * 100
      change1dAbs = nav - openNav
    }
  }

  const asOf = asOfToday()

  return (
    <div className="py-6">
      {/* Desktop: horizontal with dividers */}
      <div className="hidden md:flex items-start divide-x divide-gray-200">
        {/* NAV / Share */}
        <div className="pr-6">
          <div className="text-xs text-gray-500 mb-0.5">NAV / Share</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          {nav > 0 ? (
            <div className="text-3xl font-bold tabular-nums mt-1">${nav.toFixed(4)}</div>
          ) : (
            <div className="mt-1"><Skeleton /></div>
          )}
        </div>

        {/* 1 Day NAV Change */}
        <div className="px-6">
          <div className="text-xs text-gray-500 mb-0.5">1 Day NAV Change</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          {change1d != null && change1dAbs != null ? (
            <div className={`text-xl font-bold tabular-nums mt-1 ${change1d >= 0 ? 'text-color-up' : 'text-color-down'}`}>
              {change1d >= 0 ? '▲' : '▼'} {change1dAbs >= 0 ? '+' : ''}{change1dAbs.toFixed(4)} ({change1d >= 0 ? '+' : ''}{change1d.toFixed(2)}%)
            </div>
          ) : (
            <div className="text-xl font-bold tabular-nums mt-1 text-gray-400">—</div>
          )}
        </div>

        {/* Total Value Locked */}
        <div className="px-6">
          <div className="text-xs text-gray-500 mb-0.5">Total Value Locked</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          <div className="text-xl font-bold tabular-nums mt-1">
            {aum > 0 ? formatUsd(aum) : '—'}
          </div>
        </div>

        {/* Holdings */}
        <div className="pl-6">
          <div className="text-xs text-gray-500 mb-0.5">Holdings</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          <div className="text-xl font-bold tabular-nums mt-1">
            {assetCount > 0 ? assetCount : '—'}
          </div>
        </div>
      </div>

      {/* Mobile: 2-col grid */}
      <div className="grid grid-cols-2 gap-4 md:hidden">
        <div className="border-b border-gray-100 pb-4">
          <div className="text-xs text-gray-500 mb-0.5">NAV / Share</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          {nav > 0 ? (
            <div className="text-2xl font-bold tabular-nums mt-1">${nav.toFixed(4)}</div>
          ) : (
            <div className="mt-1"><Skeleton /></div>
          )}
        </div>
        <div className="border-b border-gray-100 pb-4">
          <div className="text-xs text-gray-500 mb-0.5">1 Day NAV Change</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          {change1d != null ? (
            <div className={`text-lg font-bold tabular-nums mt-1 ${change1d >= 0 ? 'text-color-up' : 'text-color-down'}`}>
              {change1d >= 0 ? '+' : ''}{change1d.toFixed(2)}%
            </div>
          ) : (
            <div className="text-lg font-bold tabular-nums mt-1 text-gray-400">—</div>
          )}
        </div>
        <div className="border-b border-gray-100 pb-4">
          <div className="text-xs text-gray-500 mb-0.5">Total Value Locked</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          <div className="text-lg font-bold tabular-nums mt-1">{aum > 0 ? formatUsd(aum) : '—'}</div>
        </div>
        <div className="border-b border-gray-100 pb-4">
          <div className="text-xs text-gray-500 mb-0.5">Holdings</div>
          <div className="text-[10px] text-gray-400">as of {asOf}</div>
          <div className="text-lg font-bold tabular-nums mt-1">{assetCount > 0 ? assetCount : '—'}</div>
        </div>
      </div>
    </div>
  )
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(2)}`
}
