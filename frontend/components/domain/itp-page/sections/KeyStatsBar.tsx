import type { SectionProps } from '../SectionRenderer'

export function KeyStatsBar({ nav, aum, assetCount, sinceInception }: SectionProps) {
  const formatUsd = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
    ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(2)}`

  const stats = [
    { label: 'NAV / SHARE', value: `$${nav.toFixed(4)}` },
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
        </div>
      ))}
    </div>
  )
}
