'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useItpNavSeries, type NavTimeframe } from '@/hooks/useItpNavSeries'
import type { SectionProps } from '../SectionRenderer'

function asOfToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TIMEFRAMES: { label: string; value: NavTimeframe }[] = [
  { label: '1D', value: '5m' },
  { label: '7D', value: '1h' },
  { label: '90D', value: '1d' },
]

export function PerformanceChart({ itpId, nav, createdAt }: SectionProps) {
  const [tf, setTf] = useState<NavTimeframe>('1h')
  const { data, isLoading } = useItpNavSeries(itpId, tf)

  const chartData = data.map(d => ({
    time: d.time,
    nav: d.close,
  }))

  const sinceInception = nav > 0 ? (nav - 1) * 100 : null
  const inceptionDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000)
    if (tf === '5m') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (tf === '1h') return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Performance</h2>
          <p className="text-xs text-text-muted mt-1">as of {asOfToday()}</p>
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map(t => (
            <button
              key={t.value}
              onClick={() => setTf(t.value)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                tf === t.value
                  ? 'bg-text-primary text-text-inverse'
                  : 'bg-muted text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="py-4">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 h-full w-full rounded" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center bg-surface rounded">
            <p className="text-sm text-text-muted">Performance data not yet available</p>
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
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(4)}`, 'NAV']}
                labelFormatter={(ts: number) => new Date(ts * 1000).toLocaleString()}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e5e7eb',
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

      {/* Since Inception Return */}
      {sinceInception != null && inceptionDate && (
        <div className="mt-4 pt-4 border-t border-border-light">
          <span className="text-xs text-text-secondary">Since Inception Return: </span>
          <span className={`text-lg font-bold ${sinceInception >= 0 ? 'text-color-up' : 'text-color-down'}`}>
            {sinceInception >= 0 ? '+' : ''}{sinceInception.toFixed(2)}%
          </span>
          <span className="text-xs text-text-muted ml-2">(from {inceptionDate})</span>
        </div>
      )}
    </section>
  )
}
