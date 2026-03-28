'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts'
import { useItpNavSeries, useBtcPriceSeries, type NavTimeframe } from '@/hooks/useItpNavSeries'
import { DATA_NODE_URL } from '@/lib/config'
import type { SectionProps } from '../SectionRenderer'

const TIMEFRAME_SECONDS: Record<NavTimeframe, number> = {
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
}

const TZ_OFFSET_SEC = new Date().getTimezoneOffset() * -60

const TIMEFRAMES: { label: string; value: NavTimeframe }[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
]

export function PerformanceChart({ itpId, nav, createdAt }: SectionProps) {
  const t = useTranslations('markets.itp_page.performance')
  const tc = useTranslations('markets.chart')
  const locale = useLocale()
  const [timeframe, setTimeframe] = useState<NavTimeframe>('5m')
  const [showBtc, setShowBtc] = useState(false)
  const [chartReady, setChartReady] = useState(false)

  const createdAtSec = createdAt ? Math.floor(new Date(createdAt).getTime() / 1000) : undefined
  const { data, isLoading, error } = useItpNavSeries(itpId, timeframe, createdAtSec)
  const { data: btcData } = useBtcPriceSeries(timeframe, showBtc, createdAtSec)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const btcSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const sinceInception = nav > 0 ? (nav - 1) * 100 : null
  const inceptionDate = createdAt
    ? new Date(createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  // Create chart on mount — dynamic import to avoid SSR crash
  useEffect(() => {
    if (!chartContainerRef.current) return

    let cancelled = false

    import('lightweight-charts').then((lc) => {
      if (cancelled || !chartContainerRef.current) return

      const chart = lc.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 360,
        layout: {
          background: { color: '#fafafa' },
          textColor: '#71717a',
          fontFamily: 'sans-serif',
        },
        grid: {
          vertLines: { color: '#f4f4f5' },
          horzLines: { color: '#f4f4f5' },
        },
        crosshair: {
          vertLine: { color: '#18181b', width: 1, style: 2 },
          horzLine: { color: '#18181b', width: 1, style: 2 },
        },
        timeScale: {
          borderColor: '#e4e4e7',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#e4e4e7',
        },
      })

      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: '#16a34a',
        downColor: '#dc2626',
        borderUpColor: '#16a34a',
        borderDownColor: '#dc2626',
        wickUpColor: '#16a34a',
        wickDownColor: '#dc2626',
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      })

      const btcSeries = chart.addSeries(lc.LineSeries, {
        color: '#f7931a',
        lineWidth: 2,
        priceScaleId: 'btc',
        visible: false,
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      })
      chart.priceScale('btc').applyOptions({ visible: false })

      chartRef.current = chart
      seriesRef.current = series
      btcSeriesRef.current = btcSeries
      setChartReady(true)
    })

    return () => {
      cancelled = true
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        btcSeriesRef.current = null
      }
      setChartReady(false)
    }
  }, [])

  // ResizeObserver for responsive width
  useEffect(() => {
    if (!chartReady || !chartContainerRef.current || !chartRef.current) return

    const container = chartContainerRef.current
    const chart = chartRef.current

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    ro.observe(container)

    return () => ro.disconnect()
  }, [chartReady])

  // Update candlestick data
  useEffect(() => {
    if (!chartReady || !seriesRef.current || data.length === 0) return

    const deduped = new Map<number, typeof data[0]>()
    for (const p of data) {
      deduped.set(p.time, p)
    }
    const sorted = Array.from(deduped.values()).sort((a, b) => a.time - b.time)

    const candleData: CandlestickData<Time>[] = sorted.map(p => ({
      time: (p.time + TZ_OFFSET_SEC) as Time,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }))

    seriesRef.current.setData(candleData)
    chartRef.current?.timeScale().fitContent()
  }, [data, chartReady])

  // Update BTC overlay
  useEffect(() => {
    if (!chartReady || !btcSeriesRef.current) return

    btcSeriesRef.current.applyOptions({ visible: showBtc })

    if (!showBtc || btcData.length === 0 || data.length === 0) {
      if (!showBtc) btcSeriesRef.current.setData([])
      return
    }

    const itpStartTime = data[0].time
    const itpFirstClose = data[0].close
    const clipped = btcData.filter(p => p.time >= itpStartTime)
    if (clipped.length === 0) return

    const btcFirstValue = clipped[0].value
    if (btcFirstValue === 0) return

    const scale = itpFirstClose / btcFirstValue

    const deduped = new Map<number, typeof clipped[0]>()
    for (const p of clipped) {
      deduped.set(p.time, p)
    }
    const sorted = Array.from(deduped.values()).sort((a, b) => a.time - b.time)

    const lineData = sorted.map(p => ({
      time: (p.time + TZ_OFFSET_SEC) as Time,
      value: p.value * scale,
    }))

    btcSeriesRef.current.setData(lineData)
    chartRef.current?.timeScale().fitContent()
  }, [btcData, showBtc, data, chartReady])

  // Live candle polling every 2s
  useEffect(() => {
    if (!chartReady || !seriesRef.current || data.length === 0) return

    const bucketSecs = TIMEFRAME_SECONDS[timeframe]
    const liveCandle = { open: 0, high: -Infinity, low: Infinity, close: 0, initialized: false }

    const poll = async () => {
      try {
        const res = await fetch(
          `${DATA_NODE_URL}/itp-price?itp_id=${itpId}`,
          { signal: AbortSignal.timeout(3000) }
        )
        if (!res.ok) return
        const json = await res.json()
        if (!json.nav_display) return

        const price = parseFloat(json.nav_display)
        if (isNaN(price) || price === 0) return

        const nowSecs = Math.floor(Date.now() / 1000)
        const bucketTime = Math.floor(nowSecs / bucketSecs) * bucketSecs + TZ_OFFSET_SEC

        if (!liveCandle.initialized) {
          const lastHistorical = data[data.length - 1]
          if (lastHistorical && (lastHistorical.time + TZ_OFFSET_SEC) === bucketTime) {
            liveCandle.open = lastHistorical.open
            liveCandle.high = Math.max(lastHistorical.high, price)
            liveCandle.low = Math.min(lastHistorical.low, price)
          } else {
            liveCandle.open = price
            liveCandle.high = price
            liveCandle.low = price
          }
          liveCandle.initialized = true
        } else {
          liveCandle.high = Math.max(liveCandle.high, price)
          liveCandle.low = Math.min(liveCandle.low, price)
        }
        liveCandle.close = price

        seriesRef.current?.update({
          time: bucketTime as Time,
          open: liveCandle.open,
          high: liveCandle.high,
          low: liveCandle.low,
          close: liveCandle.close,
        })
      } catch {
        // Silently ignore fetch errors
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [chartReady, data, timeframe, itpId])

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-text-primary">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 fluid-btn-group">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  timeframe === tf.value
                    ? 'bg-text-primary text-text-inverse'
                    : 'bg-muted text-text-secondary hover:text-text-primary'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBtc(v => !v)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              showBtc
                ? 'bg-[#f7931a]/20 text-[#f7931a] border border-[#f7931a]/50'
                : 'bg-muted text-text-secondary border border-border-light hover:border-zinc-500'
            }`}
          >
            BTC
          </button>
        </div>
      </div>

      <div className="relative">
        <div ref={chartContainerRef} style={{ height: 360 }} />
        {isLoading && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center">
              <div className="inline-block w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm text-text-muted">{tc('loading')}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center">
              <p className="text-sm text-color-down mb-1">{tc('error')}</p>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <p className="text-sm text-text-muted">{t('no_data')}</p>
          </div>
        )}
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

// ── Count-up -- runs once on first viewport entry, then instant updates ──
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
