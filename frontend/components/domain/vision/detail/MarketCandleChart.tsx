'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  IPriceLine,
  AutoscaleInfo,
} from 'lightweight-charts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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

// The runway: the empty space to the right of the last candle, reserved for the
// gap to settlement. Held at a fixed fraction of the visible width so the
// "time until it settles" reads the same on every chart, regardless of how far
// off the real settle time is.
const RUNWAY_FRAC = 0.15

// ── Types ────────────────────────────────────────────────────────────────────

export type Timeframe = '5m' | '15m' | '1h' | '1d'

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

/**
 * Cached, shareable query for a single market's history. The parent prefetches
 * this on hover so a click swaps the chart instantly instead of dropping to a
 * loading state.
 */
export function chartHistoryQueryOptions(
  sourceId: string,
  assetId: string,
  timeframe: Timeframe,
) {
  const dataNodeId = toInternalId(sourceId)
  const lookbackMs = TIMEFRAME_LOOKBACK_MS[timeframe]
  return {
    queryKey: ['chart-history', dataNodeId, assetId, timeframe] as const,
    queryFn: async (): Promise<HistoryPoint[]> => {
      const to = new Date()
      const from = new Date(to.getTime() - lookbackMs)
      const url = `/api/market/history?source=${encodeURIComponent(dataNodeId)}&asset=${encodeURIComponent(assetId)}&from=${from.toISOString()}&to=${to.toISOString()}`
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { prices?: Array<{ fetchedAt?: string; value?: string | number }> } = await res.json()
      const raw = data.prices ?? []
      return raw
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
    },
    // The history we already have is enough — completed candles don't
    // change, and the live tail moves slowly enough that a 2-minute
    // staleTime feels real-time without thrashing the chart on every
    // focus/blur. Default refetchOnWindowFocus was repainting the chart
    // every time the user alt-tabbed and back.
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  }
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
  /**
   * The round's open price — frozen once per round in the parent and shared
   * with the mini-cards, so every chart reads the same number. null until the
   * open is known for this round.
   */
  openPrice: number | null
  /**
   * Selected candle timeframe. Lifted to the parent so hover-prefetch on
   * the mini-cards can warm the cache for the actual user-chosen resolution.
   */
  timeframe: Timeframe
  onTimeframeChange: (t: Timeframe) => void
  /** Fires once when the first history fetch + chart draw complete. */
  onReady?: () => void
  /**
   * The market's resolution side — UP_X or DOWN_X. When provided alongside a
   * non-zero thresholdBps, the chart paints a colored square at (settle time,
   * threshold price): green for UP_X, red for DOWN_X. UP_0/DOWN_0 carry no
   * threshold and render no square.
   */
  resolutionType?: string | null
  /** Bps move that decides the binary. Threshold = open × (1 ± bps/10000). */
  thresholdBps?: number | null
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

// ── Autoscale: keep the threshold on the price axis ──────────────────────────
// lightweight-charts fits the price axis to the candle data alone — it ignores
// price lines and overlays. So a threshold sitting a few percent off the recent
// candles falls clean off the top or bottom of the plot, and the marker/zone
// computed via priceToCoordinate land off-screen. This provider widens the
// series' own range to include the threshold (and open/close), the exact
// Y-axis twin of the yDomain padding the small cards already do.
function makeAutoscaleProvider(extra: number[]) {
  const finite = extra.filter(v => Number.isFinite(v))
  return (original: () => AutoscaleInfo | null): AutoscaleInfo | null => {
    const base = original()
    if (finite.length === 0) return base
    const lo = Math.min(...finite)
    const hi = Math.max(...finite)
    if (!base || !base.priceRange) {
      return { priceRange: { minValue: lo, maxValue: hi } }
    }
    return {
      ...base,
      priceRange: {
        minValue: Math.min(base.priceRange.minValue, lo),
        maxValue: Math.max(base.priceRange.maxValue, hi),
      },
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function MarketCandleChart({
  sourceId,
  source,
  market,
  roundOpenAt,
  roundCloseAt,
  resolved,
  openPrice,
  timeframe,
  onTimeframeChange,
  onReady,
  resolutionType,
  thresholdBps,
}: MarketCandleChartProps) {
  const [imgErr, setImgErr] = useState(false)

  // useQuery with keepPreviousData so the previous asset's candles stay visible
  // while the next asset's history loads. Combined with no `key` prop on the
  // component, this gives the user a soft in-place swap instead of a remount.
  const {
    data: points,
    isLoading: loading,
    isError: error,
  } = useQuery({
    ...chartHistoryQueryOptions(sourceId, market.assetId, timeframe),
    placeholderData: keepPreviousData,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const openLineRef = useRef<IPriceLine | null>(null)
  const closeLineRef = useRef<IPriceLine | null>(null)
  const thresholdLineRef = useRef<IPriceLine | null>(null)
  const [chartReady, setChartReady] = useState(false)

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

  // -- Bucketize points → candles. The open is the shared, frozen round-open
  //    from the parent (openPrice prop); here we only derive the close and the
  //    this-round change against it from this feed's own samples. --
  const { candles, closePrice, changePct } = useMemo(() => {
    if (!points || points.length === 0) {
      return { candles: [] as Candle[], closePrice: null, changePct: null }
    }
    const cs = bucketize(points, TIMEFRAME_BUCKET_MS[timeframe])
    let close: number | null = null
    if (roundOpenAt != null && openPrice != null) {
      const sorted = [...points].sort((a, b) => a.ts - b.ts)
      if (resolved && roundCloseAt != null) {
        let lastInWindow = sorted[0]
        for (const p of sorted) {
          if (p.ts <= roundCloseAt) lastInWindow = p
          else break
        }
        close = lastInWindow.value
      } else {
        close = sorted[sorted.length - 1].value
      }
    }
    const pct = openPrice != null && close != null ? ((close - openPrice) / openPrice) * 100 : null
    return { candles: cs, closePrice: close, changePct: pct }
  }, [points, timeframe, roundOpenAt, roundCloseAt, resolved, openPrice])

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
    // Reserve a fixed runway on the right instead of fitting the candles edge
    // to edge. The last bar lands at (1 − RUNWAY_FRAC) of the width; the rest
    // is empty space for the settlement marker to live in.
    const lastIdx = data.length - 1
    const from = -0.5
    const total = (lastIdx - from) / (1 - RUNWAY_FRAC)
    chartRef.current?.timeScale().setVisibleLogicalRange({ from, to: from + total })
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

  // -- Settlement square: at (roundCloseAt, threshold) --
  // During an active round, threshold is computed off the round's open price.
  // Between rounds (settling / pending / absent), there is no open yet — fall
  // back to the latest snapshot value so the square previews where the
  // threshold will sit when the next round opens. UP_X paints green at +bps;
  // DOWN_X paints red at −bps; UP_0/DOWN_0 sit on the reference price itself.
  const settlement = useMemo<
    { color: string; price: number; time: number | null } | null
  >(() => {
    const latest = parseFloat(market.value)
    const referencePrice = openPrice ?? (isFinite(latest) ? latest : null)
    if (referencePrice == null) return null
    const referenceTime = roundCloseAt // null is fine — recompute clamps x.
    const bps = thresholdBps ?? 0
    const type = (resolutionType ?? '').toUpperCase()
    if (type === 'UP_X' && bps > 0) {
      return { color: APPLE_GREEN, price: referencePrice * (1 + bps / 10000), time: referenceTime }
    }
    if (type === 'DOWN_X' && bps > 0) {
      return { color: APPLE_RED, price: referencePrice * (1 - bps / 10000), time: referenceTime }
    }
    if (type === 'UP_0') {
      return { color: APPLE_GREEN, price: referencePrice, time: referenceTime }
    }
    if (type === 'DOWN_0') {
      return { color: APPLE_RED, price: referencePrice, time: referenceTime }
    }
    return null
  }, [openPrice, roundCloseAt, resolutionType, thresholdBps, market.value])

  // -- Keep the threshold (and open/close) inside the price axis. Declared
  // before the marker/zone effects so the scale is already widened when they
  // read priceToCoordinate. A fresh provider closure each time forces the
  // series to recompute its range. --
  useEffect(() => {
    if (!chartReady || !seriesRef.current) return
    const extra: number[] = []
    if (settlement) extra.push(settlement.price)
    if (openPrice != null) extra.push(openPrice)
    if (closePrice != null) extra.push(closePrice)
    seriesRef.current.applyOptions({ autoscaleInfoProvider: makeAutoscaleProvider(extra) })
  }, [chartReady, settlement, openPrice, closePrice, candles])

  const [squarePos, setSquarePos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    // The square marks one exact point — (close time, threshold). It only makes
    // sense once the round has resolved and that close time actually sits on the
    // chart. During a live round the close is in the future, timeToCoordinate
    // returns null, and the old code clamped the square to the right edge — which
    // reads as "stuck on the Y axis." In that case we show nothing here; the
    // threshold price line (drawn below) carries the level across the whole X.
    if (!chartReady || !settlement || !resolved || settlement.time == null) {
      setSquarePos(null)
      return
    }
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    const recompute = () => {
      const yCoord = series.priceToCoordinate(settlement.price)
      const timeSec = ((settlement.time! / 1000) + TZ_OFFSET_SEC) as Time
      const xCoord = chart.timeScale().timeToCoordinate(timeSec)
      if (yCoord == null || xCoord == null) {
        setSquarePos(null)
        return
      }
      setSquarePos({ left: xCoord as unknown as number, top: yCoord as unknown as number })
    }

    recompute()
    const ts = chart.timeScale()
    ts.subscribeVisibleTimeRangeChange(recompute)
    ts.subscribeVisibleLogicalRangeChange(recompute)
    const ro = new ResizeObserver(recompute)
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ts.unsubscribeVisibleTimeRangeChange(recompute)
      ts.unsubscribeVisibleLogicalRangeChange(recompute)
      ro.disconnect()
    }
  }, [chartReady, settlement, resolved, candles])

  // -- Live target zone: the blue rectangle from the last close to the
  // threshold crossing. The crossing pins to the right edge of the plot (the
  // end of the 15% runway); the threshold price gives its Y. Mirrors the
  // small-card treatment so the two charts read the same. --
  const [zone, setZone] = useState<
    { lastX: number; lastY: number; crossX: number; crossY: number } | null
  >(null)

  useEffect(() => {
    if (!chartReady || !settlement || resolved || candles.length === 0) {
      setZone(null)
      return
    }
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    const last = candles[candles.length - 1]
    const lastTime = ((last.time + TZ_OFFSET_SEC) as Time)

    const recompute = () => {
      const ts = chart.timeScale()
      const crossX = ts.width()
      const lastX = ts.timeToCoordinate(lastTime)
      const lastY = series.priceToCoordinate(last.close)
      const crossY = series.priceToCoordinate(settlement.price)
      if (lastX == null || lastY == null || crossY == null) {
        setZone(null)
        return
      }
      setZone({
        lastX: lastX as unknown as number,
        lastY: lastY as unknown as number,
        crossX,
        crossY: crossY as unknown as number,
      })
    }

    recompute()
    // The threshold price line is created in a sibling effect on the same
    // commit; its autoscale pull only lands on the next frame. Recompute then
    // so the crossing sits on the threshold instead of off-canvas on first paint.
    const raf = requestAnimationFrame(recompute)
    const ts = chart.timeScale()
    ts.subscribeVisibleTimeRangeChange(recompute)
    ts.subscribeVisibleLogicalRangeChange(recompute)
    const ro = new ResizeObserver(recompute)
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(raf)
      ts.unsubscribeVisibleTimeRangeChange(recompute)
      ts.unsubscribeVisibleLogicalRangeChange(recompute)
      ro.disconnect()
    }
  }, [chartReady, settlement, resolved, candles])

  // -- Overlay: round-open + close + live threshold price lines --
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
    if (thresholdLineRef.current) {
      seriesRef.current.removePriceLine(thresholdLineRef.current)
      thresholdLineRef.current = null
    }

    // Live round: the close time is in the future, so the threshold can't be a
    // point on the chart. Draw it as a horizontal line spanning the whole X —
    // "you win if it closes above/below here" — instead of a square pinned right.
    if (settlement && !resolved) {
      thresholdLineRef.current = seriesRef.current.createPriceLine({
        price: settlement.price,
        color: settlement.color,
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: 'settles',
      })
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
  }, [chartReady, openPrice, closePrice, resolved, changePct, settlement])

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
      <div className="flex items-center gap-3" style={{ padding: '11px 16px', borderBottom: `1px solid ${APPLE_LINE}` }}>
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

        <TimeframeStrip value={timeframe} onChange={onTimeframeChange} />
      </div>

      {/* Chart body — height tracks the viewport so the candle + the mini-card
          grid below it land inside one screen on a laptop. Re-fits on resize
          via the window listener above (clientHeight is read fresh). */}
      <div style={{ position: 'relative', height: 'clamp(180px, 27vh, 290px)' }}>
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

        {/* Live target zone: blue rectangle from the last close to the
            threshold crossing, the full-height settle line, and the crossing
            marker — the runway made visible. */}
        {settlement && zone && (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: zone.lastX,
                top: Math.min(zone.lastY, zone.crossY),
                width: Math.max(0, zone.crossX - zone.lastX),
                height: Math.abs(zone.crossY - zone.lastY),
                background: 'rgba(0,113,227,0.10)',
                borderTop: '1px solid rgba(0,113,227,0.22)',
                borderBottom: '1px solid rgba(0,113,227,0.22)',
                pointerEvents: 'none',
                transition: `all 120ms ${EASE_DEFAULT}`,
                zIndex: 1,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: zone.crossX,
                top: 0,
                bottom: 0,
                borderLeft: `1px dashed ${APPLE_TEXT_SECONDARY}`,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: zone.crossX,
                top: zone.crossY,
                width: 12,
                height: 12,
                transform: 'translate(-50%, -50%)',
                background: settlement.color,
                border: '1.5px solid #FFFFFF',
                borderRadius: 2,
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                pointerEvents: 'none',
                transition: `left 120ms ${EASE_DEFAULT}, top 120ms ${EASE_DEFAULT}`,
                zIndex: 2,
              }}
              title={`Settles ${(resolutionType ?? '').toLowerCase()} at ${settlement.price.toFixed(6)}`}
            />
          </>
        )}

        {/* Resolved: the close already happened — pin the marker at its true
            (close time, threshold) point. */}
        {settlement && squarePos && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: squarePos.left,
              top: squarePos.top,
              width: 12,
              height: 12,
              transform: 'translate(-50%, -50%)',
              background: settlement.color,
              border: '1.5px solid #FFFFFF',
              borderRadius: 2,
              boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
              pointerEvents: 'none',
              transition: `left 120ms ${EASE_DEFAULT}, top 120ms ${EASE_DEFAULT}`,
              zIndex: 2,
            }}
            title={`Settles ${(resolutionType ?? '').toLowerCase()} at ${settlement.price.toFixed(6)}`}
          />
        )}
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
