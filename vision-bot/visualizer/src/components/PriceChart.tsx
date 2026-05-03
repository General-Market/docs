import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { AssetDoc, Bet, PricePoint } from '@/lib/types'
import { STRATEGIES, makeActualBetLookup, priceAt } from '@/lib/strategies'

interface Props {
  data: AssetDoc
  overlay: 'ai' | 'actual' | 'none'
}

export function PriceChart({ data, overlay }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  // Mount: build the chart once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0c0e' },
        textColor: '#8b929d',
        fontFamily: 'Inter, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: { borderColor: '#20242b' },
      timeScale: { borderColor: '#20242b', timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3a414c', width: 1, style: 0 },
        horzLine: { color: '#3a414c', width: 1, style: 0 },
      },
      autoSize: false,
    })
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#a8b3c2',
      topColor: 'rgba(168,179,194,0.18)',
      bottomColor: 'rgba(168,179,194,0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const markers = createSeriesMarkers(series, [])
    chartRef.current = chart
    seriesRef.current = series
    markersRef.current = markers

    const resize = () => {
      if (!container || !chartRef.current) return
      chartRef.current.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      markersRef.current = null
    }
  }, [])

  // Data + markers update whenever the asset or overlay changes.
  useEffect(() => {
    const series = seriesRef.current
    const markers = markersRef.current
    const chart = chartRef.current
    if (!series || !markers || !chart) return

    const points = dedupeAndSort(data.history).map((p) => ({
      time: p.ts as UTCTimestamp,
      value: p.price,
    }))
    series.setData(points)

    markers.setMarkers(buildMarkers(data, overlay))
    chart.timeScale().fitContent()
  }, [data, overlay])

  return <div ref={containerRef} className="absolute inset-0" />
}

// Lightweight Charts requires strictly increasing, deduplicated timestamps.
function dedupeAndSort(history: PricePoint[]): PricePoint[] {
  const sorted = [...history].sort((a, b) => a.ts - b.ts)
  const out: PricePoint[] = []
  let lastTs = -Infinity
  for (const p of sorted) {
    if (p.ts === lastTs) continue
    out.push(p)
    lastTs = p.ts
  }
  return out
}

function buildMarkers(data: AssetDoc, overlay: 'ai' | 'actual' | 'none'): SeriesMarker<Time>[] {
  const series = data.history
  if (!series.length) return []
  const trades = data.trades ?? []

  const out: SeriesMarker<Time>[] = []
  for (const t of trades) {
    out.push(tradeMarker(t.bet, t.joined_at))
  }

  if (overlay !== 'none') {
    const strat = STRATEGIES.find((s) => s.key === overlay)
    if (strat) {
      const actualBet = makeActualBetLookup(trades)
      const stride = Math.max(1, Math.floor(series.length / 80))
      for (let i = 0; i < series.length; i += stride) {
        const bet = strat.decide(i, series, { actualBet })
        if (!bet) continue
        out.push(overlayMarker(bet, series[i].ts, strat.color))
      }
    }
  }

  // Lightweight Charts requires markers in ascending time order.
  out.sort((a, b) => (a.time as number) - (b.time as number))
  return out
}

function tradeMarker(bet: Bet, ts: number): SeriesMarker<Time> {
  return {
    time: ts as UTCTimestamp,
    position: bet === 'UP' ? 'belowBar' : 'aboveBar',
    color: bet === 'UP' ? '#74e0a3' : '#f87171',
    shape: bet === 'UP' ? 'arrowUp' : 'arrowDown',
    size: 1.5,
  }
}

function overlayMarker(bet: Bet, ts: number, color: string): SeriesMarker<Time> {
  return {
    time: ts as UTCTimestamp,
    position: bet === 'UP' ? 'belowBar' : 'aboveBar',
    color,
    shape: bet === 'UP' ? 'arrowUp' : 'arrowDown',
    size: 0.7,
  }
}

// priceAt is exported only so other panels can reuse it in the future.
export { priceAt }
