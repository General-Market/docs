'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useItpNavSeries, type NavTimeframe } from '@/hooks/useItpNavSeries'
import { NavCanvas, type ChartHoverInfo } from './NavCanvas'
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
  const t = useTranslations('markets.itp_page.performance')
  const [tf, setTf] = useState<NavTimeframe>('1h')
  const { data, isLoading } = useItpNavSeries(itpId, tf)
  const [hover, setHover] = useState<ChartHoverInfo | null>(null)

  const chartData = useMemo(() => {
    const points = data.map(d => ({ time: d.time, close: d.close }))
    // Append current live NAV so chart tip matches the displayed price
    if (nav > 0 && points.length > 0) {
      const nowSec = Math.floor(Date.now() / 1000)
      const last = points[points.length - 1]
      // Only append if live price is newer than the last candle
      if (nowSec > last.time) {
        points.push({ time: nowSec, close: nav })
      }
    }
    return points
  }, [data, nav])
  const sinceInception = nav > 0 ? (nav - 1) * 100 : null
  const inceptionDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="min-h-[48px] flex flex-col justify-center">
          {hover ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-text-primary font-mono">
                  ${hover.value >= 1 ? hover.value.toFixed(4) : hover.value.toFixed(6)}
                </span>
                <span className={`text-sm font-bold tabular-nums ${hover.changePercent >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                  {hover.changePercent >= 0 ? '+' : ''}{hover.changePercent.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {new Date(hover.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-text-primary">{t('title')}</h2>
              <p className="text-xs text-text-muted mt-1">{t('as_of', { date: asOfToday() })}</p>
            </>
          )}
        </div>
        <div className="flex gap-1 fluid-btn-group">
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
        <NavCanvas
          data={chartData}
          isLoading={isLoading}
          height={300}
          onHoverChange={setHover}
        />
      </div>

      {sinceInception != null && inceptionDate && (
        <div className="mt-4 pt-4 border-t border-border-light">
          <span className="text-xs text-text-secondary">{t('since_inception_return')}</span>
          <span className={`text-lg font-bold ${sinceInception >= 0 ? 'text-color-up' : 'text-color-down'}`}>
            <CountUp value={sinceInception} />
          </span>
          <span className="text-xs text-text-muted ml-2">{t('from_date', { date: inceptionDate })}</span>
        </div>
      )}
    </section>
  )
}

// ── Count-up — runs once on first viewport entry, then instant updates ──
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  const animated = useRef(false)
  const valRef = useRef(value); valRef.current = value

  const doCount = useCallback(() => {
    if (animated.current) return
    animated.current = true
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = valRef.current
    if (reduced) { setDisplay(target); return }
    const t0 = performance.now()
    const dur = 900
    const frame = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      setDisplay(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (animated.current) { setDisplay(value); return }
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { doCount(); obs.disconnect() }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value, doCount])

  return <span ref={ref}>{display >= 0 ? '+' : ''}{display.toFixed(2)}%</span>
}
