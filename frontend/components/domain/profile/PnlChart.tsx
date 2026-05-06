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
  /** Controlled range — when provided, `onRangeChange` is required and the
   *  parent owns range state. Lets the page refetch the right granularity
   *  from the issuer. */
  range?: TimeRange
  onRangeChange?: (r: TimeRange) => void
}

export type { TimeRange as PnlTimeRange }

export function PnlChart({ history, hero, currentPnlOverride, range: controlledRange, onRangeChange }: PnlChartProps) {
  const t = useTranslations('common')
  const locale = useLocale()
  const [internalRange, setInternalRange] = useState<TimeRange>('ALL')
  const range = controlledRange ?? internalRange
  const setRange = (r: TimeRange) => {
    if (onRangeChange) onRangeChange(r)
    else setInternalRange(r)
  }

  // Build the working series. If we have history, we trust it but tip the
  // last sample at the live override so the curve always closes at "now".
  // If we have no history at all, draw an honest slope from PnL=0 at the
  // window's start to the current override at NOW — this still represents
  // "you went from zero to +X" without inventing a path.
  const baseHistory = useMemo<PnlPoint[]>(() => {
    const now = Date.now()
    // Empty or single-point histories don't draw a line. Synthesize an
    // honest 0 → current slope across the visible window so the chart
    // shows movement until enough real samples accumulate.
    if (history.length < 2) {
      const tip = currentPnlOverride ?? (history[0]?.pnl ?? 0)
      const span = RANGE_MS[range] ?? 30 * 24 * 60 * 60 * 1000
      return [
        { timestamp: new Date(now - span).toISOString(), pnl: 0 } as PnlPoint,
        { timestamp: new Date(now).toISOString(), pnl: tip } as PnlPoint,
      ]
    }
    if (currentPnlOverride === undefined) return history
    const last = history[history.length - 1]
    const lastTs = new Date(last.timestamp).getTime()
    if (now - lastTs <= 30_000) {
      return [...history.slice(0, -1), { timestamp: last.timestamp, pnl: currentPnlOverride } as PnlPoint]
    }
    return [...history, { timestamp: new Date(now).toISOString(), pnl: currentPnlOverride } as PnlPoint]
  }, [history, currentPnlOverride, range])

  const filtered = useMemo(() => {
    const cutoff = RANGE_MS[range]
    if (!cutoff) return baseHistory
    const now = Date.now()
    const windowed = baseHistory.filter(
      (p) => now - new Date(p.timestamp).getTime() <= cutoff,
    )
    // A window with too few points (sparse historical data, or a young
    // vault) reads as a flat line. Fall back to the broadest set of points
    // we *do* have so the user sees real variation.
    if (windowed.length >= 2) return windowed
    if (baseHistory.length >= 2) return baseHistory
    return baseHistory.slice(-2)
  }, [baseHistory, range])

  const currentPnl =
    currentPnlOverride !== undefined
      ? currentPnlOverride
      : filtered.length > 0
        ? filtered[filtered.length - 1].pnl
        : 0
  const isPositive = currentPnl >= 0
  // iOS HIG systemGreen / systemRed (light mode).
  const strokeColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'
  const fillColor = strokeColor
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

  const pnlColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'

  return (
    <div
      className={hero ? 'h-full flex flex-col' : 'border border-border-light rounded overflow-hidden'}
      style={hero ? { fontFamily: 'var(--apple-font-text)' } : undefined}
    >
      {/* Header */}
      <div className={`flex items-start justify-between ${hero ? 'px-6 pt-6 pb-2' : 'px-3 py-2'}`}>
        {hero ? (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span
                aria-hidden="true"
                className={`inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-l-transparent border-r-transparent ${isPositive ? 'border-b-[7px]' : 'border-t-[7px]'}`}
                style={{
                  borderBottomColor: isPositive ? pnlColor : undefined,
                  borderTopColor: !isPositive ? pnlColor : undefined,
                }}
              />
              <span
                style={{
                  color: 'var(--apple-text)',
                  fontSize: 'var(--apple-fs-12)',
                  fontWeight: 500,
                  letterSpacing: 'var(--apple-track-loose)',
                }}
              >
                Profit / Loss
              </span>
            </div>
            <div
              className="tabular-nums"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 'clamp(32px, 5.5vw, var(--apple-fs-48))',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tighter)',
                color: pnlColor,
                lineHeight: 1.0714,
              }}
            >
              <RollingNumber value={currentPnl} format={formatPnl} />
            </div>
            <div
              className="mt-2"
              style={{
                color: 'var(--apple-text-tertiary)',
                fontSize: 'var(--apple-fs-14)',
                letterSpacing: 'var(--apple-track-mid)',
              }}
            >
              {rangeLabel[range]}
            </div>
          </div>
        ) : (
          <div className={`text-subhead font-extrabold font-mono ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
            {currentPnl >= 0 ? '+' : ''}${currentPnl.toFixed(2)}
          </div>
        )}

        {/* Time range pills — Apple iOS systemBlue when active */}
        {hero && (
          <div className="flex items-center gap-1 shrink-0">
            {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--apple-r-pill)',
                  fontSize: 'var(--apple-fs-12)',
                  fontWeight: 500,
                  letterSpacing: 'var(--apple-track-mid)',
                  background: range === r ? 'rgba(0,122,255,0.10)' : 'transparent',
                  color: range === r ? '#007AFF' : 'var(--apple-text-secondary)',
                  transition: 'background 240ms var(--apple-ease-default), color 240ms var(--apple-ease-default)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        {!hero && (
          <div className="flex items-center gap-1 shrink-0">
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
        )}
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
