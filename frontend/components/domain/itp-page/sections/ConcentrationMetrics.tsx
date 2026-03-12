'use client'

import { useMemo } from 'react'
import type { SectionProps } from '../SectionRenderer'

export function ConcentrationMetrics({ enrichment }: SectionProps) {
  const holdings = enrichment?.holdings ?? []

  const metrics = useMemo(() => {
    if (holdings.length === 0) return null
    const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
    const top5 = sorted.slice(0, 5).reduce((s, h) => s + h.weight, 0) * 100
    const top10 = sorted.slice(0, 10).reduce((s, h) => s + h.weight, 0) * 100
    const hhi = sorted.reduce((s, h) => s + Math.pow(h.weight * 100, 2), 0)
    const hhiLabel = hhi < 1500 ? 'Low' : hhi < 2500 ? 'Moderate' : 'High'
    return { top5, top10, hhi, hhiLabel }
  }, [holdings])

  if (!metrics) return null

  const cards = [
    { label: 'TOP 5 WEIGHT', value: `${metrics.top5.toFixed(1)}%` },
    { label: 'TOP 10 WEIGHT', value: `${metrics.top10.toFixed(1)}%` },
    { label: 'HHI CONCENTRATION', value: `${Math.round(metrics.hhi)}`, sub: metrics.hhiLabel },
  ]

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4">
        Concentration Metrics
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border-light border border-border-light rounded-lg overflow-hidden">
        {cards.map(c => (
          <div key={c.label} className="bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              {c.label}
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-text-primary">
              {c.value}
            </div>
            {c.sub && (
              <div className="text-xs text-text-secondary mt-0.5">{c.sub}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
