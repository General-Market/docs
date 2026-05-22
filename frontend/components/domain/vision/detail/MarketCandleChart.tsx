'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  IPriceLine,
} from 'lightweight-charts'
import { toInternalId } from '@/lib/vision/source-ids'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'

// Kick the chunk download at module-eval time so the bundle lands in parallel
// with the React render and the history fetch.
const lwPromise = typeof window === 'undefined' ? null : import('lightweight-charts')

// ── Apple tokens ─────────────────────────────────────────────────────────────

const APPLE_GREEN = '#28CD41'
const APPLE_RED = '#FF3B30'
const APPLE_TEXT = '#1D1D1F'
const APPLE_TEXT_SECONDARY = '#86868B'
const APPLE_PANEL = '#FFFFFF'
const APPLE_CHIP_BG = '#F5F5F7'
const APPLE_LINE = '#E5E5E5'
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.6, 1)'
const FONT_DISPLAY = 'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif'
const FONT_TEXT = 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif'
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const TZ_OFFSET_SEC = new Date().getTimezoneOffset() * -60

// ── Types ────────────────────────────────────────────────────────────────────

type Timeframe = '5m' | '15m' | '1h' | '1d'

const TIMEFRAME_BUCKET_MS: Record<Timeframe, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
}

const TIMEFRAME_LOOKBACK_MS: Record<Timeframe, number> = {
  '5m': 24 * 60 * 60 * 1000,     // 24h of 5m candles
  '15m': 3 * 24 * 60 * 60 * 1000, // 3 days
  '1h': 14 * 24 * 60 * 60 * 1000, // 14 days
  '1d': 90 * 24 * 60 * 60 * 1000, // 90 days
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
]

interface HistoryPoint {
  ts: number
  value: number
}

interface MarketCandleChartProps {
  sourceId: string
  source: { prefixes: string[]; isPrice: boolean; valueLabel: string }
  market: SnapshotPrice
  /** Round-open timestamp in ms epoch — null when no round is active. */
  roundOpenAt: number | null
  /** Round-close timestamp in ms epoch — null when no round is active. */
  roundCloseAt: number | null
  /** True once the countdown has hit zero. */
  resolved: boolean
  /** Fires once when the first history fetch + chart draw complete. */
  onReady?: () => void
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatBigUsd(value: string | number | null): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatPct(n: number, opts: { sign?: boolean } = {}): string {
  if (!isFinite(n)) return '—'
  const sign = opts.sign && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

// ── Bucketing: point series → OHLC candles ───────────────────────────────────

interface Candle {
  time: number // seconds, with TZ offset baked in for display
  open: number
  high: number
  low: number
  close: number
}

function bucketize(points: HistoryPoint[], bucketMs: number): Candle[] {
  if (points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.ts - b.ts)
  const candles: Candle[] = []
  let curStart = Math.floor(sorted[0].ts / bucketMs) * bucketMs
  let cur: Candle = {
    time: curStart / 1000,
    open: sorted[0].value,
    high: sorted[0].value,
    low: sorted[0].value,
    close: sorted[0].value,
  }
  for (const p of sorted) {
    const start = Math.floor(p.ts / bucketMs) * bucketMs
    if (start !== curStart) {
      candles.push(cur)
      curStart = start
      cur = {
        time: start / 1000,
        open: p.value,
        high: p.value,
        low: p.value,
        close: p.value,
      }
    } else {
      cur.high = Math.max(cur.high, p.value)
      cur.low = Math.min(cur.low, p.value)
      cur.close = p.value
    }
  }
  candles.push(cur)
  return candles
}

// ── Component ────────────────────────────────────────────────────────────────

export function MarketCandleChart({
  sourceId,
  source,
  market,
  roundOpenAt,
  roundCloseAt,
  resolved,
  onReady,
}: MarketCandleChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1h')
  const [points, setPoints] = useState<HistoryPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const openLineRef = useRef<IPriceLine | null>(null)
  const closeLineRef = useRef<IPriceLine | null>(null)
  const [chartReady, setChartReady] = useState(false)

  // -- Fetch history when market or timeframe changes --
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const dataNodeId = toInternalId(sourceId)
    const to = new Date()
    const from = new Date(to.getTime() - TIMEFRAME_LOOKBACK_MS[timeframe])
    const url = `/api/market/history?source=${encodeURIComponent(dataNodeId)}&asset=${encodeURIComponent(market.assetId)}&from=${from.toISOString()}&to=${to.toISOString()}`
    fetch(url, { signal: AbortSignal.timeout(15_000) })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { prices?: Array<{ fetchedAt?: string; value?: string | number }> }) => {
        if (cancelled) return
        const raw = data.prices ?? []
        const parsed: HistoryPoint[] = raw
          .map(p => ({
            ts: p.fetchedAt ? new Date(p.fetchedAt).getTime() : 0,
            value:
              typeof p.value === 'string'
                ? parseFloat(p.value)
                : typeof p.value === 'number'
                  ? p.value
                  : NaN,
          }))
          .filter(p => isFinite(p.value) && p.ts > 0)
        setPoints(parsed)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sourceId, market.assetId, timeframe])

  // -- Create the chart once --
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    ;(lwPromise ?? import('lightweight-charts')).then(lc => {
      if (cancelled || !containerRef.current) return

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { color: APPLE_PANEL },
          textColor: APPLE_TEXT_SECONDARY,
          fontFamily: 'var(--apple-font-text), -apple-system, sans-serif',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: APPLE_CHIP_BG },
        },
        crosshair: {
          vertLine: { color: '#1D1D1F', width: 1, style: 3 },
          horzLine: { color: '#1D1D1F', width: 1, style: 3 },
        },
        timeScale: {
          borderColor: APPLE_LINE,
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: APPLE_LINE,
        },
      })

      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: APPLE_GREEN,
        downColor: APPLE_RED,
        borderUpColor: APPLE_GREEN,
        borderDownColor: APPLE_RED,
        wickUpColor: APPLE_GREEN,
        wickDownColor: APPLE_RED,
      })

      chartRef.current = chart
      seriesRef.current = series
      setChartReady(true)
    })

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
      openLineRef.current = null
      closeLineRef.current = null
      setChartReady(false)
    }
  }, [])

  // -- Bucketize points → candles + derive open/close inside the round window --
  const { candles, openPrice, closePrice, changePct } = useMemo(() => {
    if (!points || points.length === 0) {
      return { candles: [] as Candle[], openPrice: null, closePrice: null, changePct: null }
    }
    const cs = bucketize(points, TIMEFRAME_BUCKET_MS[timeframe])
    let open: number | null = null
    let close: number | null = null
    if (roundOpenAt != null) {
      const sorted = [...points].sort((a, b) => a.ts - b.ts)
      const openPoint = sorted.find(p => p.ts >= roundOpenAt) ?? sorted[0]
      open = openPoint.value
      if (resolved && roundCloseAt != null) {
        let lastInWindow = openPoint
        for (const p of sorted) {
          if (p.ts <= roundCloseAt) lastInWindow = p
          else break
        }
        close = lastInWindow.value
      } else {
        close = sorted[sorted.length - 1].value
      }
    }
    const pct = open && close ? ((close - open) / open) * 100 : null
    return { candles: cs, openPrice: open, closePrice: close, changePct: pct }
  }, [points, timeframe, roundOpenAt, roundCloseAt, resolved])

  // -- Push candles into the series --
  const firstDrawDone = useRef(false)
  useEffect(() => {
    if (!chartReady || !seriesRef.current) return
    if (candles.length === 0) {
      seriesRef.current.setData([])
      return
    }
    const data: CandlestickData<Time>[] = candles.map(c => ({
      time: (c.time + TZ_OFFSET_SEC) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
    if (!firstDrawDone.current) {
      firstDrawDone.current = true
      onReady?.()
    }
  }, [candles, chartReady, onReady])

  // If history fails or returns nothing, still resolve the parent's wait gate
  // so the page doesn't sit on a loader forever.
  useEffect(() => {
    if (firstDrawDone.current) return
    if (!loading && (error || points?.length === 0)) {
      firstDrawDone.current = true
      onReady?.()
    }
  }, [loading, error, points, onReady])

  // -- Overlay: round-open + close price lines --
  useEffect(() => {
    if (!chartReady || !seriesRef.current) return

    // Clear previous lines before drawing new ones.
    if (openLineRef.current) {
      seriesRef.current.removePriceLine(openLineRef.current)
      openLineRef.current = null
    }
    if (closeLineRef.current) {
      seriesRef.current.removePriceLine(closeLineRef.current)
      closeLineRef.current = null
    }

    if (openPrice != null) {
      openLineRef.current = seriesRef.current.createPriceLine({
        price: openPrice,
        color: APPLE_TEXT_SECONDARY,
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: 'open',
      })
    }
    if (resolved && closePrice != null && openPrice != null) {
      const up = closePrice >= openPrice
      closeLineRef.current = seriesRef.current.createPriceLine({
        price: closePrice,
        color: up ? APPLE_GREEN : APPLE_RED,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: up ? `close +${changePct?.toFixed(2)}%` : `close ${changePct?.toFixed(2)}%`,
      })
    }
  }, [chartReady, openPrice, closePrice, resolved, changePct])

  // -- Header values --
  const name = market.name || market.symbol || market.assetId
  const value = formatBigUsd(market.value)
  const subLabel = source.isPrice ? 'price' : (source.valueLabel || '').toLowerCase()
  const imgSrc =
    !imgErr && (market.imageUrl || getAssetImageUrl(sourceId, market.assetId, source.prefixes))
  const liveChangePct = changePct

  return (
    <section
      style={{
        background: APPLE_PANEL,
        border: `1px solid ${APPLE_LINE}`,
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3" style={{ padding: '14px 18px', borderBottom: `1px solid ${APPLE_LINE}` }}>
        <div
          className="shrink-0 inline-flex items-center justify-center overflow-hidden"
          style={{ width: 36, height: 36, background: APPLE_CHIP_BG, borderRadius: 8 }}
          aria-hidden
        >
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt=""
              width={36}
              height={36}
              className="object-cover w-full h-full"
              loading="lazy"
              onError={() => setImgErr(true)}
            />
          ) : (
            <span style={{ fontFamily: FONT_TEXT, fontSize: 16, fontWeight: 600, color: APPLE_TEXT }}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              color: APPLE_TEXT,
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              color: APPLE_TEXT_SECONDARY,
              letterSpacing: '+0.011em',
              textTransform: 'uppercase',
            }}
          >
            {market.symbol || subLabel}
          </div>
        </div>

        <div className="text-right">
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '-0.022em',
              color: APPLE_TEXT,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {value}
          </div>
          {liveChangePct != null && (
            <div
              style={{
                marginTop: 2,
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '+0.011em',
                color: liveChangePct >= 0 ? '#1A9D34' : '#C92A1F',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatPct(liveChangePct, { sign: true })}
              <span style={{ marginLeft: 6, color: APPLE_TEXT_SECONDARY }}>
                this round
              </span>
            </div>
          )}
        </div>

        <TimeframeStrip value={timeframe} onChange={setTimeframe} />
      </div>

      {/* Chart body */}
      <div style={{ position: 'relative', height: 360 }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: APPLE_CHIP_BG,
              opacity: 0.5,
            }}
          />
        )}
        {error && !loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: FONT_TEXT, fontSize: 13, color: APPLE_TEXT_SECONDARY }}>
              History temporarily unavailable.
            </span>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </section>
  )
}

// ── Timeframe selector ───────────────────────────────────────────────────────

function TimeframeStrip({ value, onChange }: { value: Timeframe; onChange: (v: Timeframe) => void }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        background: APPLE_CHIP_BG,
        borderRadius: 8,
        padding: 2,
        marginLeft: 12,
      }}
    >
      {TIMEFRAMES.map(tf => {
        const active = tf.value === value
        return (
          <button
            key={tf.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(tf.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: active ? APPLE_PANEL : 'transparent',
              color: active ? APPLE_TEXT : APPLE_TEXT_SECONDARY,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : undefined,
              transition: `background 180ms ${EASE_DEFAULT}, color 180ms ${EASE_DEFAULT}`,
            }}
          >
            {tf.label}
          </button>
        )
      })}
    </div>
  )
}
