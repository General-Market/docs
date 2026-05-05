'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PnlPoint } from '@/hooks/usePlayerProfile'
import { RollingNumber } from '@/components/ui/RollingNumber'

type TimeRange = '1D' | '1W' | '1M' | 'ALL'

const RANGE_MS: Record<TimeRange, number | null> = {
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  ALL: null,
}

interface PnlChartProps {
  history: PnlPoint[]
  /** Hero mode — taller chart, prominent P&L figure, label header */
  hero?: boolean
  /** Override the headline PnL value (for tabs that compute PnL outside the history series). */
  currentPnlOverride?: number
}

export function PnlChart({ history, hero, currentPnlOverride }: PnlChartProps) {
  const t = useTranslations('common')
  const locale = useLocale()
  const [range, setRange] = useState<TimeRange>('ALL')

  // Empty history → render a two-point flat line at the override value (or zero),
  // so the chart shape reads "nothing yet" without looking broken.
  const baseHistory = useMemo<PnlPoint[]>(() => {
    if (history.length > 0) return history
    const flatValue = currentPnlOverride ?? 0
    const now = Date.now()
    return [
      { timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(), pnl: flatValue } as PnlPoint,
      { timestamp: new Date(now).toISOString(), pnl: flatValue } as PnlPoint,
    ]
  }, [history, currentPnlOverride])

  const filtered = useMemo(() => {
    const cutoff = RANGE_MS[range]
    if (!cutoff) return baseHistory
    const now = Date.now()
    const windowed = baseHistory.filter(
      (p) => now - new Date(p.timestamp).getTime() <= cutoff,
    )
    // A single point doesn't draw a line — keep at least two.
    return windowed.length >= 2 ? windowed : baseHistory.slice(-2)
  }, [baseHistory, range])

  const currentPnl =
    currentPnlOverride !== undefined
      ? currentPnlOverride
      : filtered.length > 0
        ? filtered[filtered.length - 1].pnl
        : 0
  const isPositive = currentPnl >= 0
  const strokeColor = isPositive ? '#22c55e' : '#ef4444'
  const fillColor = isPositive ? '#22c55e' : '#ef4444'
  const chartHeight = hero ? 120 : 100

  const rangeLabel: Record<TimeRange, string> = {
    '1D': '24h',
    '1W': '7-day',
    '1M': '30-day',
    ALL: 'All-Time',
  }

  const formatPnl = (n: number) => {
    const sign = n >= 0 ? '+' : '-'
    const abs = Math.abs(n)
    return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className={hero ? 'h-full flex flex-col' : 'border border-border-light rounded overflow-hidden'}>
      {/* Header */}
      <div className={`flex items-start justify-between ${hero ? 'px-5 pt-5 pb-2' : 'px-3 py-2'}`}>
        {hero ? (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span aria-hidden="true" className={`inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-l-transparent border-r-transparent ${isPositive ? 'border-b-[7px] border-b-color-up' : 'border-t-[7px] border-t-color-down'}`} />
              <span className="text-[13px] font-semibold text-text-primary tracking-tight">
                Profit / Loss
              </span>
            </div>
            <div className={`text-[34px] sm:text-[40px] font-bold tabular-nums leading-[1.05] tracking-tight ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
              <RollingNumber value={currentPnl} format={formatPnl} />
            </div>
            <div className="text-[12px] text-text-muted mt-1.5 font-medium">
              {rangeLabel[range]}
            </div>
          </div>
        ) : (
          <div className={`text-subhead font-extrabold font-mono ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
            {currentPnl >= 0 ? '+' : ''}${currentPnl.toFixed(2)}
          </div>
        )}

        {/* Time range pills */}
        <div className="flex items-center gap-0.5 shrink-0">
          {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
                range === r
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-text-muted hover:text-black'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: chartHeight }} className={hero ? 'px-2 mt-auto' : ''}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp" hide />
            <YAxis
              hide
              domain={([dataMin, dataMax]: [number, number]) => {
                // Guarantee visible amplitude even on a flat line.
                if (dataMin === dataMax) {
                  const pad = Math.max(1, Math.abs(dataMin) * 0.1)
                  return [dataMin - pad, dataMax + pad]
                }
                return [dataMin, dataMax]
              }}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 11,
                padding: '4px 8px',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, t('profile.pnl_label')]}
              labelFormatter={(label: string) => {
                const d = new Date(label)
                return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
              }}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={strokeColor}
              strokeWidth={hero ? 2 : 1.5}
              fill="url(#pnlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
