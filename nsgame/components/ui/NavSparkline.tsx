'use client'

import { useEffect, useRef, useState } from 'react'
import { useItpNavSeries } from '@/hooks/useItpNavSeries'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'

interface NavSparklineProps {
  itpId: string
  height?: number
}

export function NavSparkline({ itpId, height = 120 }: NavSparklineProps) {
  const { data, isLoading } = useItpNavSeries(itpId, '5m')
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const [ready, setReady] = useState(false)

  const TZ_OFFSET_SEC = useRef(new Date().getTimezoneOffset() * -60).current

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    import('lightweight-charts').then((lc) => {
      if (cancelled || !containerRef.current) return

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: 'transparent',
          fontFamily: 'sans-serif',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        crosshair: {
          vertLine: { visible: false },
          horzLine: { visible: false },
        },
        timeScale: { visible: false },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        handleScroll: false,
        handleScale: false,
      })

      const series = chart.addSeries(lc.AreaSeries, {
        lineColor: '#e4e4e7',
        lineWidth: 2,
        topColor: 'rgba(228,228,231,0.18)',
        bottomColor: 'rgba(228,228,231,0.02)',
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      chartRef.current = chart
      seriesRef.current = series
      setReady(true)
    })

    return () => {
      cancelled = true
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
      setReady(false)
    }
  }, [height])

  // Resize
  useEffect(() => {
    if (!ready || !containerRef.current || !chartRef.current) return
    const container = containerRef.current
    const chart = chartRef.current
    const ro = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }))
    ro.observe(container)
    return () => ro.disconnect()
  }, [ready])

  // Data
  useEffect(() => {
    if (!ready || !seriesRef.current || data.length === 0) return

    const deduped = new Map<number, (typeof data)[0]>()
    for (const p of data) deduped.set(p.time, p)
    const sorted = Array.from(deduped.values()).sort((a, b) => a.time - b.time)

    // Determine color from first to last close
    const first = sorted[0].close
    const last = sorted[sorted.length - 1].close
    const up = last >= first
    const lineColor = up ? '#34d399' : '#fb7185'
    const topColor = up ? 'rgba(52,211,153,0.16)' : 'rgba(251,113,133,0.16)'
    const bottomColor = up ? 'rgba(52,211,153,0.02)' : 'rgba(251,113,133,0.02)'

    seriesRef.current.applyOptions({ lineColor, topColor, bottomColor })
    seriesRef.current.setData(
      sorted.map((p) => ({
        time: (p.time + TZ_OFFSET_SEC) as Time,
        value: p.close,
      }))
    )
    chartRef.current?.timeScale().fitContent()
  }, [data, ready, TZ_OFFSET_SEC])

  return (
    <div className="relative rounded-lg overflow-hidden border border-zinc-800 mb-4">
      <div ref={containerRef} style={{ height }} />
      {isLoading && data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
