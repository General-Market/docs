'use client'

import { useItpNavSeries } from '@/hooks/useItpNavSeries'
import type { SectionProps } from '../SectionRenderer'

export function KeyStatsBar({ itpId, nav, aum, assetCount, sinceInception }: SectionProps) {
  const { data: dayData } = useItpNavSeries(itpId, '5m')

  // Compute 1D change from the series: first point open vs current nav
  let change1d: number | null = null
  if (dayData.length > 0) {
    const openNav = dayData[0].open
    if (openNav > 0) {
      change1d = ((nav - openNav) / openNav) * 100
    }
  }

  const formatUsd = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
    ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(2)}`

  const stats = [
    {
      label: 'NAV / SHARE',
      value: `$${nav.toFixed(4)}`,
      sub: change1d != null ? `${change1d >= 0 ? '+' : ''}${change1d.toFixed(2)}%` : undefined,
      subColor: change1d != null ? (change1d >= 0 ? 'text-color-up' : 'text-color-down') : undefined,
    },
    { label: 'TOTAL VALUE LOCKED', value: formatUsd(aum) },
    { label: 'HOLDINGS', value: `${assetCount}` },
    {
      label: 'SINCE INCEPTION',
      value: `${sinceInception >= 0 ? '+' : ''}${sinceInception.toFixed(2)}%`,
      color: sinceInception >= 0 ? 'text-color-up' : 'text-color-down',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-light border border-border-light rounded-lg overflow-hidden">
      {stats.map((s) => (
        <div key={s.label} className="bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
            {s.label}
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${s.color || 'text-text-primary'}`}>
            {s.value}
          </div>
          {s.sub && (
            <div className={`text-xs font-mono tabular-nums mt-0.5 ${s.subColor || 'text-text-muted'}`}>
              {s.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
