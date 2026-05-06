'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { useTranslations, useLocale } from 'next-intl'

interface PriceHistoryPoint {
  fetchedAt: string
  value: number
}

interface SettlementMarker {
  /** Unix ms timestamp of settlement */
  at: number
  /** Outcome label drives marker color */
  outcome: 'Up' | 'Down' | 'Flat' | 'Cancelled' | 'AllSameSide' | 'AllLosers'
}

const OUTCOME_COLOR: Record<SettlementMarker['outcome'], string> = {
  Up: '#16a34a',
  Down: '#dc2626',
  Flat: '#94a3b8',
  Cancelled: '#94a3b8',
  AllSameSide: '#f59e0b',
  AllLosers: '#f59e0b',
}

function formatValue(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) < 0.0001) return v.toExponential(2)
  if (Math.abs(v) < 1) return v.toFixed(6)
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  return v.toFixed(2)
}

export default function AssetHistory({
  dataNodeSourceId,
  assetId,
  settlements = [],
}: {
  dataNodeSourceId: string
  assetId: string
  settlements?: SettlementMarker[]
}) {
  const t = useTranslations('vision')
  const locale = useLocale()
  const [points, setPoints] = useState<PriceHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const url = `/api/market/history?source=${encodeURIComponent(dataNodeSourceId)}&asset=${encodeURIComponent(assetId)}&from=${from.toISOString()}&to=${now.toISOString()}`

    fetch(url, { signal: AbortSignal.timeout(15_000) })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const prices: PriceHistoryPoint[] = (data.prices || []).map((p: Record<string, unknown>) => ({
          fetchedAt: p.fetchedAt as string,
          value: typeof p.value === 'string' ? parseFloat(p.value as string) : (p.value as number),
        }))
        setPoints(prices)
      })
      .catch(e => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [dataNodeSourceId, assetId])

  const lineColor = useMemo(() => {
    if (points.length < 2) return '#94a3b8'
    return points[points.length - 1].value >= points[0].value ? '#16a34a' : '#dc2626'
  }, [points])

  const changePct = useMemo(() => {
    if (points.length < 2) return null
    const first = points[0].value
    const last = points[points.length - 1].value
    if (first === 0) return null
    return ((last - first) / first) * 100
  }, [points])

  if (loading) {
    return (
      <div className="h-[120px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">{t('markets_table.loading_history')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">{t('markets_table.no_history')}</div>
      </div>
    )
  }

  if (points.length < 2) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">{t('markets_table.not_enough_data', { count: points.length, plural: points.length !== 1 ? 's' : '' })}</div>
      </div>
    )
  }

  // Downsample for performance
  const displayPoints = points.length > 200
    ? points.filter((_, i) => i % Math.ceil(points.length / 200) === 0 || i === points.length - 1)
    : points

  // Snap each settlement to the nearest displayed point's fetchedAt — Recharts
  // uses category-axis matching on the dataKey string, so the marker x must
  // exist in the data set or it won't render.
  const markerLines = useMemo(() => {
    if (!settlements.length || displayPoints.length === 0) return []
    const ts = displayPoints.map(p => new Date(p.fetchedAt).getTime())
    const minTs = ts[0]
    const maxTs = ts[ts.length - 1]
    return settlements
      .filter(s => s.at >= minTs && s.at <= maxTs)
      .map(s => {
        let bestIdx = 0
        let bestDiff = Math.abs(ts[0] - s.at)
        for (let i = 1; i < ts.length; i++) {
          const d = Math.abs(ts[i] - s.at)
          if (d < bestDiff) {
            bestDiff = d
            bestIdx = i
          }
        }
        return {
          x: displayPoints[bestIdx].fetchedAt,
          color: OUTCOME_COLOR[s.outcome],
          key: `${s.at}-${s.outcome}`,
        }
      })
  }, [settlements, displayPoints])

  return (
    <div className="bg-surface/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('markets_table.history_label', { count: points.length.toLocaleString() })}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-label font-mono text-text-muted">
            {formatValue(points[0].value)} &rarr; {formatValue(points[points.length - 1].value)}
          </span>
          {changePct !== null && (
            <span className={`text-label font-mono font-bold ${changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={displayPoints} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="fetchedAt"
            tick={false}
            axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: 'none',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              color: '#fff',
              padding: '4px 8px',
            }}
            labelFormatter={(label: string) => {
              const d = new Date(label)
              return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            }}
            formatter={(val: number) => [formatValue(val), t('markets_table.value_tooltip')]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {markerLines.map(m => (
            <ReferenceLine
              key={m.key}
              x={m.x}
              stroke={m.color}
              strokeWidth={1}
              strokeDasharray="2 2"
              ifOverflow="hidden"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
