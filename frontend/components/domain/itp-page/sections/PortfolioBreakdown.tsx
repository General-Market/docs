'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { SectionProps } from '../SectionRenderer'

const COLORS = [
  '#1a1a2e', '#e94560', '#0f3460', '#f97316', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6',
  '#94a3b8',
]

export function PortfolioBreakdown({ enrichment }: SectionProps) {
  const holdings = enrichment?.holdings ?? []

  const data = useMemo(() => {
    if (holdings.length === 0) return []
    const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
    const top10 = sorted.slice(0, 10).map(h => ({
      name: h.symbol,
      value: Math.round(h.weight * 10000) / 100,
    }))
    const otherWeight = sorted.slice(10).reduce((s, h) => s + h.weight, 0)
    if (otherWeight > 0) {
      top10.push({ name: 'Other', value: Math.round(otherWeight * 10000) / 100 })
    }
    return top10
  }, [holdings])

  if (data.length === 0) return null

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Portfolio Composition
      </h2>
      <div className="py-4">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-64 h-64 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  strokeWidth={1}
                  stroke="#fff"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Weight']}
                  contentStyle={{
                    fontSize: 12,
                    border: '1px solid #e5e5e5',
                    borderRadius: 6,
                    boxShadow: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-text-secondary truncate">{d.name}</span>
                <span className="ml-auto font-mono tabular-nums text-text-primary">
                  {d.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
