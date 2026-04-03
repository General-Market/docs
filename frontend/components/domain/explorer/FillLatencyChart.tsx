'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { ExplorerChartCard } from '@/components/domain/explorer'
import { chartColors, chartTooltipStyle, chartLabelStyle } from '@/lib/charts/tokens'

interface FillSpeedEntry {
  order_id: number
  side: number
  amount: string
  submit_time: string
  fill_time: string | null
  fill_latency_secs: number | null
}

const BUCKETS = [
  { label: '0–5s', min: 0, max: 5 },
  { label: '5–15s', min: 5, max: 15 },
  { label: '15–30s', min: 15, max: 30 },
  { label: '30–60s', min: 30, max: 60 },
  { label: '1–2m', min: 60, max: 120 },
  { label: '2m+', min: 120, max: Infinity },
]

/** Fast → slow latency gradient, derived from design-system tokens */
const LATENCY_COLORS = [
  chartColors.up,      // 0–5s   — fast
  '#34d399',           // 5–15s  — good (up-light)
  chartColors.warning, // 15–30s — caution
  '#F59E0B',           // 30–60s — slow (warning-light)
  chartColors.down,    // 1–2m   — bad
  '#991B1B',           // 2m+    — critical (down-dark)
]
const LATENCY_OVERFLOW = chartColors.textMuted

export function FillLatencyChart() {
  const t = useTranslations('pages')
  const [entries, setEntries] = useState<FillSpeedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dn/fill-speed')
      .then(r => r.ok ? r.json() : [])
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const histogram = useMemo(() => {
    const filled = entries.filter(e => e.fill_latency_secs != null)
    const unfilled = entries.filter(e => e.fill_latency_secs == null).length

    const data = BUCKETS.map(b => ({
      label: b.label,
      count: filled.filter(e => e.fill_latency_secs! >= b.min && e.fill_latency_secs! < b.max).length,
    }))

    if (unfilled > 0) data.push({ label: 'Unfilled', count: unfilled })
    return data
  }, [entries])

  const medianLatency = useMemo(() => {
    const sorted = entries
      .filter(e => e.fill_latency_secs != null)
      .map(e => e.fill_latency_secs!)
      .sort((a, b) => a - b)
    if (sorted.length === 0) return null
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }, [entries])

  return (
    <ExplorerChartCard
      title={t('explorer.orders_section.fill_latency')}
      subtitle={
        medianLatency != null
          ? `${t('explorer.orders_section.fill_latency_median')}: ${medianLatency.toFixed(1)}s`
          : undefined
      }
      loading={loading}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={histogram} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={chartLabelStyle} stroke={chartColors.border} />
          <YAxis tick={chartLabelStyle} stroke={chartColors.border} allowDecimals={false} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            labelStyle={{ color: chartColors.tooltipText }}
            itemStyle={{ color: chartColors.textMuted }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36} name={t('explorer.orders_section.orders')}>
            {histogram.map((_, i) => (
              <Cell key={i} fill={i < LATENCY_COLORS.length ? LATENCY_COLORS[i] : LATENCY_OVERFLOW} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ExplorerChartCard>
  )
}
