'use client'

import { useState, useEffect, useRef } from 'react'
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts'
import { useItpNavSeries, useBtcPriceSeries, NavTimeframe } from '@/hooks/useItpNavSeries'

const TIMEFRAME_SECONDS: Record<NavTimeframe, number> = {
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
}

// lightweight-charts treats timestamps as UTC — shift by local offset to display local time
const TZ_OFFSET_SEC = new Date().getTimezoneOffset() * -60

const TIMEFRAMES: { label: string; value: NavTimeframe }[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
]

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

interface ChartModalProps {
  itpId: string
  itpName: string
  createdAt?: number
  onClose: () => void
}

export function ChartModal({ itpId, itpName, createdAt, onClose }: ChartModalProps) {
  const [timeframe, setTimeframe] = useState<NavTimeframe>('5m')
  const [showBtc, setShowBtc] = useState(false)
  const { data, isLoading, error } = useItpNavSeries(itpId, timeframe, createdAt)
  const { data: btcData } = useBtcPriceSeries(timeframe, showBtc, createdAt)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const btcSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  // Track when chart instance is ready so data effects can depend on it
  const [chartReady, setChartReady] = useState(false)

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
          background: { color: '#0a0a0a' },
          textColor: '#888',
          fontFamily: 'monospace',
        },
        grid: {
          vertLines: { color: '#1a1a1a' },
          horzLines: { color: '#1a1a1a' },
        },
        crosshair: {
          vertLine: { color: '#C40000', width: 1, style: 2 },
          horzLine: { color: '#C40000', width: 1, style: 2 },
        },
        timeScale: {
          borderColor: '#333',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#333',
        },
      })

      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
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
      chart.priceScale('btc').applyOptions({
        visible: false,
      })

      chartRef.current = chart
      seriesRef.current = series
      btcSeriesRef.current = btcSeries
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
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        btcSeriesRef.current = null
      }
      setChartReady(false)
    }
  }, [])

  // Update data when it changes OR when chart becomes ready
  useEffect(() => {
    if (!chartReady || !seriesRef.current || data.length === 0) return

    // Deduplicate by timestamp (keep last entry per time) and sort
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

  // Update BTC overlay when data or toggle changes
  useEffect(() => {
    if (!chartReady || !btcSeriesRef.current) return

    btcSeriesRef.current.applyOptions({ visible: showBtc })

    if (!showBtc || btcData.length === 0 || data.length === 0) {
      if (!showBtc) btcSeriesRef.current.setData([])
      return
    }

    // Clip BTC data to start at the same time as the ITP candles
    const itpStartTime = data[0].time
    const itpFirstClose = data[0].close
    const clipped = btcData.filter(p => p.time >= itpStartTime)
    if (clipped.length === 0) return

    // Normalize: rebase so first BTC point after ITP start = first ITP close
    const btcFirstValue = clipped[0].value
    if (btcFirstValue === 0) return

    const scale = itpFirstClose / btcFirstValue

    // Deduplicate BTC data too
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

  // Live candle: poll /itp-price every 2s and update the current candle in real-time
  useEffect(() => {
    if (!chartReady || !seriesRef.current || data.length === 0) return

    const bucketSecs = TIMEFRAME_SECONDS[timeframe]
    // Track the current live candle OHLC
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
          // Seed from the last historical candle if it's the same bucket
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

    // Poll immediately, then every 2s
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [chartReady, data, timeframe, itpId])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-terminal border border-white/20 rounded-lg max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-accent">{itpName}</h2>
            <p className="text-xs text-white/40 font-mono">NAV OHLC</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                    timeframe === tf.value
                      ? 'bg-accent/20 text-accent border border-accent/50'
                      : 'text-white/50 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowBtc(v => !v)}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                showBtc
                  ? 'bg-[#f7931a]/20 text-[#f7931a] border border-[#f7931a]/50'
                  : 'text-white/50 border border-white/10 hover:border-white/30'
              }`}
            >
              BTC
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-4 relative">
          <div ref={chartContainerRef} className="w-full" style={{ height: 360 }} />
          {(isLoading && data.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
              <div className="text-center">
                <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-sm text-white/50">Loading NAV data...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
              <div className="text-center">
                <p className="text-sm text-red-400 mb-1">Failed to load chart data</p>
                <p className="text-xs text-white/40">{error}</p>
              </div>
            </div>
          )}
          {!isLoading && !error && data.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
              <p className="text-sm text-white/40">No NAV data available for this timeframe</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
