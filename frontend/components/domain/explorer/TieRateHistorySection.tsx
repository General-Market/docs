'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { ExplorerChartCard } from './ExplorerChartCard'

/**
 * Per-source hourly row from the oracle.
 * Each row = one (hour, source) pair with round counts and tie counts.
 */
interface TieRateHistoryRow {
  hour: string
  source_id: string
  total_rounds: number
  ties: number
}

/** Aggregated point for the chart: one row per hour. */
interface ChartPoint {
  hour: string
  label: string
  aggregate: number
  [source: string]: string | number
}

type ViewMode = 'aggregate' | 'top5'

const SOURCE_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
]

export function TieRateHistorySection() {
  const [raw, setRaw] = useState<TieRateHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ViewMode>('aggregate')

  useEffect(() => {
    let cancelled = false
    fetch('/api/vision/explorer/tie-rate-history')
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setRaw(d.history ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Identify top 5 sources by total round volume (most data = most meaningful lines)
  const top5Sources = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const r of raw) {
      totals[r.source_id] = (totals[r.source_id] ?? 0) + r.total_rounds
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)
  }, [raw])

  // Build chart data: one point per hour
  const chartData = useMemo(() => {
    if (raw.length === 0) return []

    // Group by hour
    const byHour: Record<string, TieRateHistoryRow[]> = {}
    for (const r of raw) {
      const key = r.hour
      if (!byHour[key]) byHour[key] = []
      byHour[key].push(r)
    }

    const hours = Object.keys(byHour).sort()
    return hours.map((hour): ChartPoint => {
      const rows = byHour[hour]
      const totalRounds = rows.reduce((s, r) => s + r.total_rounds, 0)
      const totalTies = rows.reduce((s, r) => s + r.ties, 0)
      const aggregate = totalRounds > 0 ? (totalTies / totalRounds) * 100 : 0

      const point: ChartPoint = {
        hour,
        label: new Date(hour).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        aggregate: Math.round(aggregate * 10) / 10,
      }

      // Per-source rates for top 5
      if (mode === 'top5') {
        for (const sid of top5Sources) {
          const sr = rows.find(r => r.source_id === sid)
          if (sr && sr.total_rounds > 0) {
            point[sid] = Math.round((sr.ties / sr.total_rounds) * 100 * 10) / 10
          } else {
            point[sid] = 0
          }
        }
      }

      return point
    })
  }, [raw, mode, top5Sources])

  // Summary stats
  const summary = useMemo(() => {
    if (raw.length === 0) return { totalRounds: 0, avgTie: 0, hours: 0 }
    const totalRounds = raw.reduce((s, r) => s + r.total_rounds, 0)
    const totalTies = raw.reduce((s, r) => s + r.ties, 0)
    const hours = new Set(raw.map(r => r.hour)).size
    return {
      totalRounds,
      avgTie: totalRounds > 0 ? (totalTies / totalRounds) * 100 : 0,
      hours,
    }
  }, [raw])

  const noData = !loading && chartData.length === 0

  return (
    <ExplorerChartCard
      title="Tie Rate Over Time"
      subtitle={
        noData
          ? 'Awaiting oracle endpoint'
          : `${summary.hours} hours · ${summary.totalRounds.toLocaleString()} rounds · ${summary.avgTie.toFixed(1)}% avg`
      }
      loading={loading}
    >
      {noData ? (
        <div className="h-[260px] flex items-center justify-center">
          <p className="text-label text-white/30">No tie-rate history available yet</p>
        </div>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-1.5 mb-3">
            <ModeButton active={mode === 'aggregate'} onClick={() => setMode('aggregate')}>
              Aggregate
            </ModeButton>
            <ModeButton active={mode === 'top5'} onClick={() => setMode('top5')}>
              Top 5 Sources
            </ModeButton>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(20,20,25,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                  }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'aggregate' ? 'All Sources' : name]}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                />

                {/* Aggregate line — always visible */}
                <Area
                  type="monotone"
                  dataKey="aggregate"
                  name="All Sources"
                  stroke="#fff"
                  strokeWidth={mode === 'aggregate' ? 2 : 1}
                  fill="#fff"
                  fillOpacity={mode === 'aggregate' ? 0.08 : 0.02}
                  dot={false}
                />

                {/* Per-source lines when in top5 mode */}
                {mode === 'top5' &&
                  top5Sources.map((sid, i) => (
                    <Area
                      key={sid}
                      type="monotone"
                      dataKey={sid}
                      name={sid.replace(/_/g, ' ')}
                      stroke={SOURCE_COLORS[i]}
                      strokeWidth={1.5}
                      fill={SOURCE_COLORS[i]}
                      fillOpacity={0.04}
                      dot={false}
                    />
                  ))}

                {mode === 'top5' && (
                  <Legend
                    verticalAlign="top"
                    height={28}
                    wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ExplorerChartCard>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-label font-bold rounded transition-colors ${
        active
          ? 'bg-white/[0.12] text-white'
          : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  )
}
