'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  ZAxis,
} from 'recharts'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SimRun {
  id: number
  category_id: string
  top_n: number
  weighting: string
  rebalance_days: number
  total_return_pct: number | null
  annualized_return: number | null
  max_drawdown_pct: number | null
  sharpe_ratio: number | null
}

const CATEGORY_COLORS: Record<string, string> = {
  layer1: '#3b82f6',
  defi: '#10b981',
  ai: '#a78bfa',
  meme: '#f59e0b',
  gaming: '#ec4899',
  rwa: '#06b6d4',
  infra: '#8b5cf6',
}

function categoryColor(cat: string): string {
  const key = Object.keys(CATEGORY_COLORS).find(k => cat.toLowerCase().includes(k))
  return key ? CATEGORY_COLORS[key] : '#6b7280'
}

export function SharpeFrontierChart() {
  const t = useTranslations('pages')
  const [runs, setRuns] = useState<SimRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dn/sim/results')
      .then(r => r.ok ? r.json() : { results: [] })
      .then(data => setRuns(data.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const scatterData = useMemo(() => {
    return runs
      .filter(r =>
        r.annualized_return != null &&
        r.max_drawdown_pct != null &&
        r.sharpe_ratio != null
      )
      .map(r => ({
        x: Math.abs(r.max_drawdown_pct!),
        y: r.annualized_return!,
        sharpe: r.sharpe_ratio!,
        category: r.category_id,
        weighting: r.weighting,
        rebalance: r.rebalance_days,
        label: `${r.category_id} (${r.weighting}, ${r.rebalance_days}d)`,
      }))
  }, [runs])

  const categories = useMemo(() => {
    return [...new Set(scatterData.map(d => d.category))]
  }, [scatterData])

  return (
    <ExplorerChartCard
      title={t('explorer.itp_section.sharpe_frontier')}
      subtitle={`${scatterData.length} ${t('explorer.itp_section.simulations_plotted')}`}
      loading={loading}
      className="md:col-span-2"
    >
      {scatterData.length > 0 ? (
        <div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Max Drawdown"
                unit="%"
                tick={{ fontSize: 10, fill: '#999' }}
                stroke="#ccc"
                label={{ value: t('explorer.itp_section.max_drawdown'), position: 'insideBottom', offset: -2, fontSize: 10, fill: '#666' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Annual Return"
                unit="%"
                tick={{ fontSize: 10, fill: '#999' }}
                stroke="#ccc"
                label={{ value: t('explorer.itp_section.annual_return'), angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#666' }}
              />
              <ZAxis type="number" dataKey="sharpe" range={[30, 200]} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#ccc' }}
                formatter={(value: number, name: string) => {
                  if (name === 'Max Drawdown') return [`${value.toFixed(1)}%`, name]
                  if (name === 'Annual Return') return [`${value.toFixed(1)}%`, name]
                  if (name === 'sharpe') return [value.toFixed(2), 'Sharpe']
                  return [value, name]
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-md px-3 py-2 text-xs">
                      <div className="font-bold text-white mb-1">{d.label}</div>
                      <div className="text-white/60">Return: <span className="text-white">{d.y.toFixed(1)}%</span></div>
                      <div className="text-white/60">Drawdown: <span className="text-white">{d.x.toFixed(1)}%</span></div>
                      <div className="text-white/60">Sharpe: <span className="text-white">{d.sharpe.toFixed(2)}</span></div>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={categoryColor(d.category)} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2 px-1">
            {categories.map(cat => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryColor(cat) }} />
                <span className="text-micro text-white/50">{cat}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-caption text-white/40">{t('explorer.itp_section.no_sim_data')}</p>
        </div>
      )}
    </ExplorerChartCard>
  )
}
