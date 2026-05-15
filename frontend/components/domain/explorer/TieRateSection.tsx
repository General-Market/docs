'use client'

import { useEffect, useState } from 'react'
import { ExplorerChartCard } from './ExplorerChartCard'

interface TieRateEntry {
  source: string
  total: number
  ties: number
  pct: number
}

export function TieRateSection() {
  const [data, setData] = useState<TieRateEntry[]>([])

  useEffect(() => {
    fetch('/api/vision/explorer/tie-rates')
      .then(r => r.json())
      .then(d => setData(d.tieRates ?? []))
      .catch(() => {})
  }, [])

  if (data.length === 0) return null

  const maxPct = Math.max(...data.map(d => d.pct), 1)
  const avgTie = data.reduce((sum, d) => sum + d.pct, 0) / data.length
  const totalRounds = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <ExplorerChartCard
      title="Tie Rate by Source"
      subtitle={`${data.length} sources \u00b7 ${totalRounds.toLocaleString()} rounds \u00b7 ${avgTie.toFixed(1)}% avg tie rate`}
      bodyClassName="min-h-[200px]"
    >
      <div className="p-4 space-y-0.5 max-h-[500px] overflow-y-auto" style={{ overflowY: 'auto' }}>
        {[...data].sort((a, b) => a.pct - b.pct).map(d => (
          <div key={d.source} className="grid grid-cols-[100px_1fr_44px_44px] gap-2 items-center group hover:bg-black/[0.04] rounded px-1 -mx-1">
            <div className="text-[10px] font-mono text-[#86868b] truncate group-hover:text-[#1d1d1f] transition-colors">
              {d.source}
            </div>
            <div className="h-3.5 bg-black/[0.06] rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm transition-all ${
                  d.pct > 30 ? 'bg-[#D70015]/80' : d.pct > 20 ? 'bg-[#B25600]/70' : d.pct > 10 ? 'bg-[#B25600]/40' : 'bg-[#1F8F4D]/60'
                }`}
                style={{ width: `${(d.pct / maxPct) * 100}%` }}
              />
            </div>
            <div className="text-[10px] font-mono tabular-nums text-right text-[#1d1d1f] font-semibold">
              {d.pct.toFixed(1)}%
            </div>
            <div className="text-[10px] font-mono tabular-nums text-right text-[#86868b]">
              {d.total}r
            </div>
          </div>
        ))}
      </div>
    </ExplorerChartCard>
  )
}
