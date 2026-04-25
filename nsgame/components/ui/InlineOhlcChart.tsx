'use client'

import { useState, useEffect, useRef } from 'react'
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts'
import { useItpNavSeries, NavTimeframe } from '@/hooks/useItpNavSeries'
import { DATA_NODE_URL } from '@/lib/config'

// Kick the chunk download the moment this module evaluates, not when the chart
// effect fires. Lets the bundle land in parallel with the React render and the
// nav-series fetch instead of stacking serially.
const lightweightChartsPromise = typeof window === 'undefined'
  ? null
  : import('lightweight-charts')

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

interface InlineOhlcChartProps {
  itpId: string
  height?: number
  createdAt?: number
}

export function InlineOhlcChart({ itpId, height = 200, createdAt }: InlineOhlcChartProps) {
  const [timeframe, setTimeframe] = useState<NavTimeframe>('5m')
  const { data, isLoading, error } = useItpNavSeries(itpId, timeframe, createdAt)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [chartReady, setChartReady] = useState(false)

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current) return
    let cancelled = false

    ;(lightweightChartsPromise ?? import('lightweight-charts')).then((lc) => {
      if (cancelled || !chartContainerRef.current) return

      const chart = lc.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height,
        layout: {
          background: { color: '#09090b' },
          textColor: '#a1a1aa',
          fontFamily: 'sans-serif',
        },
        grid: {
          vertLines: { color: '#27272a' },
          horzLines: { color: '#27272a' },
        },
        crosshair: {
          vertLine: { color: '#a1a1aa', width: 1, style: 2 },
          horzLine: { color: '#a1a1aa', width: 1, style: 2 },
        },
        timeScale: {
          borderColor: '#3f3f46',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#3f3f46',
        },
      })

      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: '#34d399',
        downColor: '#fb7185',
        borderUpColor: '#34d399',
        borderDownColor: '#fb7185',
        wickUpColor: '#34d399',
        wickDownColor: '#fb7185',
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      })

      chartRef.current = chart
      seriesRef.current = series
      setChartReady(true)
    })

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
      setChartReady(false)
    }
  }, [height])

  // Update data
  useEffect(() => {
    if (!chartReady || !seriesRef.current || data.length === 0) return

    const deduped = new Map<number, (typeof data)[0]>()
    for (const p of data) deduped.set(p.time, p)
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

  // Live candle poll
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
      } catch { /* silent */ }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [chartReady, data, timeframe, itpId])

  return (
    <div className="relative rounded-lg overflow-hidden border border-zinc-800 mb-2 bg-zinc-950">
      {/* Timeframe selector */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-colors ${
              timeframe === tf.value
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full" style={{ height }} />

      {/* Loading / error overlays */}
      {isLoading && data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}
    </div>
  )
}
