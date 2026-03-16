'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PnlPoint } from '@/hooks/usePlayerProfile'

type TimeRange = '1D' | '1W' | '1M' | 'ALL'

const RANGE_MS: Record<TimeRange, number | null> = {
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  ALL: null,
}

interface PnlChartProps {
  history: PnlPoint[]
}

export function PnlChart({ history }: PnlChartProps) {
  const [range, setRange] = useState<TimeRange>('ALL')

  const filtered = useMemo(() => {
    const cutoff = RANGE_MS[range]
    if (!cutoff) return history
    const now = Date.now()
    return history.filter((p) => now - new Date(p.timestamp).getTime() <= cutoff)
  }, [history, range])

  if (history.length === 0) {
    return (
      <div className="border border-border-light rounded p-6 h-[140px] flex items-center justify-center">
        <span className="text-[13px] text-text-muted">No P&L data yet</span>
      </div>
    )
  }

  const currentPnl = filtered.length > 0 ? filtered[filtered.length - 1].pnl : 0
  const isPositive = currentPnl >= 0
  const strokeColor = isPositive ? '#22c55e' : '#ef4444'
  const fillColor = isPositive ? '#22c55e' : '#ef4444'

  return (
    <div className="border border-border-light rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        {/* Time range toggles */}
        <div className="flex items-center gap-1">
          {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                range === r
                  ? 'bg-black text-white'
                  : 'text-text-muted hover:text-black'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Current value */}
        <div className={`text-[16px] font-extrabold font-mono ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
          {currentPnl >= 0 ? '+' : ''}${currentPnl.toFixed(2)}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 11,
                padding: '4px 8px',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
              labelFormatter={(label: string) => {
                const d = new Date(label)
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill="url(#pnlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
