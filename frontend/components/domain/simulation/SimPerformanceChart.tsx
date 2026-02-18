'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import type { SimNavPoint } from '@/hooks/useSimulation'

// Palette for sweep mode
const SWEEP_COLORS = [
  '#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa',
  '#34d399', '#fb923c', '#818cf8',
]

interface SingleChartProps {
  mode: 'single'
  navSeries: SimNavPoint[]
}

interface SweepChartProps {
  mode: 'sweep'
  variants: { label: string; navSeries: SimNavPoint[] }[]
}

type SimPerformanceChartProps = SingleChartProps | SweepChartProps

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[1]}/${parts[2].substring(0, 2)}`
}

export function SimPerformanceChart(props: SimPerformanceChartProps) {
  if (props.mode === 'single') {
    const { navSeries } = props
    if (!navSeries.length) return null

    const lastNav = navSeries[navSeries.length - 1]?.nav ?? 1
    const lineColor = lastNav >= 1.0 ? '#4ade80' : '#C40000'

    return (
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={navSeries} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
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
            <Tooltip content={<SingleTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
            <Line
              type="monotone"
              dataKey="nav"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Sweep mode
  const { variants } = props
  if (!variants.length) return null

  // Merge all nav series into unified data keyed by date
  const dateMap = new Map<string, Record<string, number>>()
  variants.forEach((v, i) => {
    v.navSeries.forEach(point => {
      const existing = dateMap.get(point.nav_date) || {}
      existing[`nav_${i}`] = point.nav
      existing['nav_date'] = point.nav_date as any
      dateMap.set(point.nav_date, existing)
    })
  })

  const merged = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({ nav_date: date, ...data }))

  return (
    <div className="mb-4">
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
          <Tooltip content={<SweepTooltip labels={variants.map(v => v.label)} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
          <Legend
            formatter={(value: string) => {
              const idx = parseInt(value.replace('nav_', ''))
              return variants[idx]?.label || value
            }}
            wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          />
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
  )
}

function SingleTooltip({ active, payload }: any) {
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
    </div>
  )
}

function SweepTooltip({ active, payload, labels }: any) {
  if (!active || !payload?.length) return null
  const date = payload[0]?.payload?.nav_date

  return (
    <div className="bg-black border border-white/20 p-2 font-mono text-xs max-w-xs">
      <div className="text-white/60 mb-1">{date}</div>
      {payload.map((p: any, i: number) => {
        const nav = p.value ?? 0
        const ret = ((nav / 1.0) - 1) * 100
        return (
          <div key={i} className="flex justify-between gap-3" style={{ color: p.stroke }}>
            <span>{labels[parseInt(p.dataKey.replace('nav_', ''))] || p.dataKey}</span>
            <span>${nav.toFixed(4)} ({ret >= 0 ? '+' : ''}{ret.toFixed(1)}%)</span>
          </div>
        )
      })}
    </div>
  )
}
