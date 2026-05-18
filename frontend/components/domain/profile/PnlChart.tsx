'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import type { PnlPoint } from '@/hooks/usePlayerProfile'
import { RollingNumber } from '@/components/ui/RollingNumber'

type TimeRange = '1D' | '1W' | '1M' | 'ALL'

const RANGE_MS: Record<TimeRange, number | null> = {
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  ALL: null,
}

// Playback sweep: ~6.5s per loop, with a brief pause at the end so the
// final value is legible before the cursor resets.
const PLAYBACK_DURATION_MS = 6500
const PLAYBACK_HOLD_MS = 1200

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
  const reduced = useReducedMotion()
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
    if (windowed.length >= 2) return windowed
    if (baseHistory.length >= 2) return baseHistory
    return baseHistory.slice(-2)
  }, [baseHistory, range])

  // Series-max cost basis — used by the Y-axis domain so a $3 drawdown on a
  // $122 position renders as a small dip, not a vertical cliff. Zero when
  // upstream points don't carry cost (e.g. legacy Vision-only feeds).
  const referenceMagnitude = useMemo(() => {
    let max = 0
    for (const p of filtered) {
      const c = p.cost
      if (typeof c === 'number' && c > max) max = c
    }
    return max
  }, [filtered])

  // Playback: an integer index into `filtered`. `null` means "show the tip".
  // The card auto-plays a sweep from the first point to the last, holds, and
  // loops — same idea as the Polymarket card, ours just rolls digits.
  const [playbackIdx, setPlaybackIdx] = useState<number | null>(null)
  const [hovering, setHovering] = useState(false)
  const playbackEnabled = hero && !reduced && !hovering && filtered.length >= 4
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playbackEnabled) {
      setPlaybackIdx(null)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startRef.current = null
      return
    }
    const total = filtered.length
    const cycle = PLAYBACK_DURATION_MS + PLAYBACK_HOLD_MS
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = (now - startRef.current) % cycle
      if (elapsed <= PLAYBACK_DURATION_MS) {
        const t = elapsed / PLAYBACK_DURATION_MS
        // Ease-out so the cursor decelerates into the present.
        const eased = 1 - Math.pow(1 - t, 2.2)
        const idx = Math.min(total - 1, Math.floor(eased * (total - 1) + 0.0001))
        setPlaybackIdx(idx)
      } else {
        setPlaybackIdx(total - 1)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startRef.current = null
    }
  }, [playbackEnabled, filtered.length])

  const cursorPoint =
    playbackIdx !== null && filtered[playbackIdx] !== undefined
      ? filtered[playbackIdx]
      : null

  const tipPnl =
    currentPnlOverride !== undefined
      ? currentPnlOverride
      : filtered.length > 0
        ? filtered[filtered.length - 1].pnl
        : 0
  const displayedPnl = cursorPoint ? cursorPoint.pnl : tipPnl
  // Headline color tracks the tip (the *current* P&L) rather than the
  // cursor's value — otherwise the title flickers green/red across the
  // sweep, which reads as noise.
  const isPositive = tipPnl >= 0
  const strokeColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'
  const fillColor = strokeColor
  const pnlColor = strokeColor
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

  const formatCursorTimestamp = (iso: string) => {
    const d = new Date(iso)
    const cutoff = RANGE_MS[range]
    // 1D: minute precision. 1W/1M: hour precision. ALL: day precision.
    if (cutoff && cutoff <= 24 * 60 * 60 * 1000) {
      return d.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    }
    if (cutoff && cutoff <= 30 * 24 * 60 * 60 * 1000) {
      return d.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
      })
    }
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Cursor x-offset as a percentage of the chart's plot area. Recharts'
  // AreaChart with margin {top:4,...0,...,0} draws edge-to-edge, so a flat
  // (idx / (n-1)) maps cleanly. Capped to avoid the line clipping the card
  // border at the extremes.
  const cursorPercent =
    playbackIdx !== null && filtered.length > 1
      ? Math.max(0.5, Math.min(99.5, (playbackIdx / (filtered.length - 1)) * 100))
      : null

  return (
    <div
      className={hero ? 'h-full flex flex-col relative' : 'border border-border-light rounded overflow-hidden'}
      style={hero ? { fontFamily: 'var(--apple-font-text)' } : undefined}
      onMouseEnter={hero ? () => setHovering(true) : undefined}
      onMouseLeave={hero ? () => setHovering(false) : undefined}
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
              <RollingNumber value={displayedPnl} format={formatPnl} duration={0.55} />
            </div>
            <div
              className="mt-2 tabular-nums"
              style={{
                color: 'var(--apple-text-tertiary)',
                fontSize: 'var(--apple-fs-14)',
                letterSpacing: 'var(--apple-track-mid)',
                minHeight: '1.4em',
              }}
            >
              {cursorPoint ? formatCursorTimestamp(cursorPoint.timestamp) : rangeLabel[range]}
            </div>
          </div>
        ) : (
          <div className={`text-subhead font-extrabold font-mono ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
            {tipPnl >= 0 ? '+' : ''}${tipPnl.toFixed(2)}
          </div>
        )}

        {/* Right cluster: range pills + brand lockup (hero only) */}
        {hero ? (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1">
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
            <BrandLockup />
          </div>
        ) : (
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
      <div style={{ height: chartHeight, position: 'relative' }} className={hero ? 'px-2 mt-auto' : ''}>
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
                // When we know the cost basis, anchor the chart so a small
                // drawdown reads as small. Floor the visible amplitude at
                // ~25% of the position size, expanding only when real
                // moves exceed it. Otherwise -$3 on a $122 ITP renders as
                // a vertical cliff thanks to recharts' tight auto-fit.
                if (referenceMagnitude > 0) {
                  const floor = referenceMagnitude * 0.25
                  const span = Math.max(dataMax - dataMin, floor)
                  const center = (dataMin + dataMax) / 2
                  const half = span / 2
                  const padded = span * 0.08
                  return [center - half - padded, center + half + padded]
                }
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
              // baseValue="dataMin" anchors the fill to the visible data's
              // minimum rather than 0 or the Y-domain bottom. Without it, an
              // expanded domain (Y clamped to ~25% of cost basis to keep small
              // dips visually small) forces recharts to close the area with a
              // huge vertical edge at the right side of the chart — reads as
              // a portfolio crash. With it, the fill is a thin ribbon under
              // the line, scaling with actual variation.
              baseValue="dataMin"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Playback cursor — thin vertical line that tracks the current
            playback index. Sits above the chart but below the tooltip layer. */}
        {hero && cursorPercent !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0"
            style={{
              left: `${cursorPercent}%`,
              width: 1,
              background: 'rgba(29,29,31,0.45)',
              transition: 'left 60ms linear',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: -2.5,
                top: 0,
                width: 6,
                height: 6,
                borderRadius: 999,
                background: pnlColor,
                boxShadow: `0 0 0 3px ${isPositive ? 'rgba(52,199,89,0.18)' : 'rgba(255,59,48,0.18)'}`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-1.5 opacity-70" aria-hidden="true">
      <svg
        width="14"
        height="14"
        viewBox="0 0 1024 1024"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="1024" height="1024" rx="232" ry="232" fill="var(--apple-text)" />
        <rect x="256" y="462" width="512" height="100" rx="50" ry="50" fill="#FFFFFF" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'var(--apple-fs-12)',
          fontWeight: 500,
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-secondary)',
        }}
      >
        general
      </span>
    </div>
  )
}
