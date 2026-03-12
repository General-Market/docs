'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useItpNavSeries, type NavTimeframe } from '@/hooks/useItpNavSeries'
import type { SectionProps } from '../SectionRenderer'

const TIMEFRAMES: { label: string; value: NavTimeframe }[] = [
  { label: '1D', value: '5m' },
  { label: '7D', value: '1h' },
  { label: '90D', value: '1d' },
]

export function PerformanceChart({ itpId }: SectionProps) {
  const [tf, setTf] = useState<NavTimeframe>('1h')
  const { data, isLoading } = useItpNavSeries(itpId, tf)

  const chartData = data.map(d => ({
    time: d.time,
    nav: d.close,
  }))

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000)
    if (tf === '5m') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (tf === '1h') return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          Performance
        </h2>
        <div className="flex gap-1">
          {TIMEFRAMES.map(t => (
            <button
              key={t.value}
              onClick={() => setTf(t.value)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                tf === t.value
                  ? 'bg-black text-white'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border-light rounded-lg p-4">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-text-muted text-sm">
            Loading chart...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-text-muted text-sm">
            No data available for this timeframe
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#000" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: '#999' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 10, fill: '#999' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(4)}`, 'NAV']}
                labelFormatter={(ts: number) => new Date(ts * 1000).toLocaleString()}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e5e5e5',
                  borderRadius: 6,
                  boxShadow: 'none',
                }}
              />
              <Area
                type="monotone"
                dataKey="nav"
                stroke="#000"
                strokeWidth={1.5}
                fill="url(#navGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
