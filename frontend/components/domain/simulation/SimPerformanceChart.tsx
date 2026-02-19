'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { SimNavPoint, SimStats } from '@/hooks/useSimulation'
import { SimVariantLegend } from './SimVariantLegend'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

// Palette for sweep mode (exported for SimVariantLegend)
export const SWEEP_COLORS = [
  '#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa',
  '#34d399', '#fb923c', '#818cf8',
]

const BTC_COLOR = '#f7931a'
const ETH_COLOR = '#627eea'

interface BenchmarkSeries {
  symbol: string
  nav_series: { nav_date: string; nav: number }[]
}

function useBenchmarks(startDate: string | undefined): BenchmarkSeries[] {
  const [data, setData] = useState<BenchmarkSeries[]>([])
  useEffect(() => {
    if (!startDate) { setData([]); return }
    let cancelled = false
    fetch(`${DATA_NODE_URL}/sim/benchmarks?start_date=${startDate}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d.benchmarks || []) })
      .catch(() => { if (!cancelled) setData([]) })
    return () => { cancelled = true }
  }, [startDate])
  return data
}

interface SingleChartProps {
  mode: 'single'
  navSeries: SimNavPoint[]
  runId?: number
  onDeployIndex?: (runId: number, label: string) => void
}

interface SweepChartProps {
  mode: 'sweep'
  variants: { label: string; navSeries: SimNavPoint[]; runId: number; stats: SimStats }[]
  onDeployIndex?: (runId: number, label: string) => void
}

type SimPerformanceChartProps = SingleChartProps | SweepChartProps

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[1]}/${parts[2].substring(0, 2)}`
}

export function SimPerformanceChart(props: SimPerformanceChartProps) {
  // Get first date from nav data to fetch benchmarks
  const startDate = props.mode === 'single'
    ? props.navSeries[0]?.nav_date
    : props.variants[0]?.navSeries[0]?.nav_date
  const benchmarks = useBenchmarks(startDate)

  if (props.mode === 'single') {
    const { navSeries, runId, onDeployIndex } = props
    if (!navSeries.length) return null

    const lastNav = navSeries[navSeries.length - 1]?.nav ?? 1
    const lineColor = lastNav >= 1.0 ? '#4ade80' : '#C40000'

    // Merge nav series with benchmark data
    const dateMap = new Map<string, Record<string, number | string>>()
    navSeries.forEach(p => {
      dateMap.set(p.nav_date, { nav_date: p.nav_date, nav: p.nav, drawdown_pct: p.drawdown_pct })
    })
    benchmarks.forEach(b => {
      const key = b.symbol === 'BTC' ? 'btc' : 'eth'
      b.nav_series.forEach(p => {
        const existing = dateMap.get(p.nav_date) || { nav_date: p.nav_date }
        existing[key] = p.nav
        dateMap.set(p.nav_date, existing)
      })
    })
    const merged = Array.from(dateMap.values()).sort((a, b) =>
      (a.nav_date as string).localeCompare(b.nav_date as string)
    )

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs text-white/40 font-mono uppercase">Performance</h3>
            {benchmarks.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span style={{ color: BTC_COLOR }}>BTC</span>
                <span style={{ color: ETH_COLOR }}>ETH</span>
              </div>
            )}
          </div>
          {runId && onDeployIndex && (
            <button
              className="text-[10px] font-mono px-3 py-1 bg-accent text-white rounded hover:bg-accent/80 transition-colors"
              onClick={() => onDeployIndex(runId, 'simulation')}
            >
              Deploy Index
            </button>
          )}
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={merged} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis
              dataKey="nav_date"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={formatDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={v => `$${Number(v).toFixed(2)}`}
              width={60}
            />
            <ReferenceLine y={1.0} stroke="#C40000" strokeDasharray="5 5" strokeOpacity={0.5} />
            <Tooltip content={<SingleTooltip hasBenchmarks={benchmarks.length > 0} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
            <Line type="monotone" dataKey="nav" stroke={lineColor} strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 1 }} />
            {benchmarks.some(b => b.symbol === 'BTC') && (
              <Line type="monotone" dataKey="btc" stroke={BTC_COLOR} strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={false} connectNulls />
            )}
            {benchmarks.some(b => b.symbol === 'ETH') && (
              <Line type="monotone" dataKey="eth" stroke={ETH_COLOR} strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={false} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Sweep mode
  const { variants, onDeployIndex } = props
  if (!variants.length) return null

  // Merge all nav series + benchmarks into unified data keyed by date
  const dateMap = new Map<string, Record<string, number>>()
  variants.forEach((v, i) => {
    v.navSeries.forEach(point => {
      const existing = dateMap.get(point.nav_date) || {}
      existing[`nav_${i}`] = point.nav
      existing['nav_date'] = point.nav_date as any
      dateMap.set(point.nav_date, existing)
    })
  })
  benchmarks.forEach(b => {
    const key = b.symbol === 'BTC' ? 'btc' : 'eth'
    b.nav_series.forEach(p => {
      const existing = dateMap.get(p.nav_date) || {}
      existing[key] = p.nav
      if (!existing['nav_date']) existing['nav_date'] = p.nav_date as any
      dateMap.set(p.nav_date, existing)
    })
  })

  const merged = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({ nav_date: date, ...data }))

  return (
    <div className="mb-4">
      <div className="flex gap-3">
        {/* Chart */}
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={merged} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis
                dataKey="nav_date"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={formatDate}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={v => `$${Number(v).toFixed(2)}`}
                width={60}
              />
              <ReferenceLine y={1.0} stroke="#C40000" strokeDasharray="5 5" strokeOpacity={0.5} />
              <Tooltip content={<SweepTooltip labels={variants.map(v => v.label)} hasBenchmarks={benchmarks.length > 0} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
              {benchmarks.some(b => b.symbol === 'BTC') && (
                <Line type="monotone" dataKey="btc" stroke={BTC_COLOR} strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={false} connectNulls />
              )}
              {benchmarks.some(b => b.symbol === 'ETH') && (
                <Line type="monotone" dataKey="eth" stroke={ETH_COLOR} strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={false} connectNulls />
              )}
              {variants.map((v, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`nav_${i}`}
                  stroke={SWEEP_COLORS[i % SWEEP_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Variant Legend */}
        <div className="w-56 flex-shrink-0">
          <SimVariantLegend
            variants={variants.map(v => ({
              label: v.label,
              runId: v.runId,
              stats: v.stats,
            }))}
            onDeployIndex={onDeployIndex}
          />
        </div>
      </div>
    </div>
  )
}

function BenchmarkTooltipRows({ data }: { data: any }) {
  const rows: { label: string; nav: number; color: string }[] = []
  if (data.btc != null) rows.push({ label: 'BTC', nav: data.btc, color: BTC_COLOR })
  if (data.eth != null) rows.push({ label: 'ETH', nav: data.eth, color: ETH_COLOR })
  if (!rows.length) return null
  return (
    <>
      <div className="border-t border-white/10 mt-1 pt-1" />
      {rows.map(r => {
        const ret = (r.nav - 1) * 100
        return (
          <div key={r.label} className="flex justify-between gap-3" style={{ color: r.color }}>
            <span>{r.label}</span>
            <span>{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</span>
          </div>
        )
      })}
    </>
  )
}

function SingleTooltip({ active, payload, hasBenchmarks }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const nav = data.nav ?? 0
  const ret = ((nav / 1.0) - 1) * 100

  return (
    <div className="bg-black border border-white/20 p-2 font-mono text-xs">
      <div className="text-white/60">{data.nav_date}</div>
      <div className={nav >= 1 ? 'text-green-400' : 'text-accent'}>
        NAV: ${nav.toFixed(4)}
      </div>
      <div className={ret >= 0 ? 'text-green-400' : 'text-accent'}>
        Return: {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
      </div>
      {data.drawdown_pct !== undefined && data.drawdown_pct < 0 && (
        <div className="text-accent">DD: {data.drawdown_pct.toFixed(2)}%</div>
      )}
      {hasBenchmarks && <BenchmarkTooltipRows data={data} />}
    </div>
  )
}

function SweepTooltip({ active, payload, labels, hasBenchmarks }: any) {
  if (!active || !payload?.length) return null
  const date = payload[0]?.payload?.nav_date
  const data = payload[0]?.payload

  return (
    <div className="bg-black border border-white/20 p-2 font-mono text-xs max-w-xs">
      <div className="text-white/60 mb-1">{date}</div>
      {payload.filter((p: any) => p.dataKey !== 'btc' && p.dataKey !== 'eth').map((p: any, i: number) => {
        const nav = p.value ?? 0
        const ret = ((nav / 1.0) - 1) * 100
        return (
          <div key={i} className="flex justify-between gap-3" style={{ color: p.stroke }}>
            <span>{labels[parseInt(p.dataKey.replace('nav_', ''))] || p.dataKey}</span>
            <span>${nav.toFixed(4)} ({ret >= 0 ? '+' : ''}{ret.toFixed(1)}%)</span>
          </div>
        )
      })}
      {hasBenchmarks && <BenchmarkTooltipRows data={data} />}
    </div>
  )
}
