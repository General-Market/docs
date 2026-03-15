'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

interface BatchData {
  id: number
  source_id: string
  current_tick: number
  tick_duration: number
  player_count: number
  tvl: string
  market_count: number
  paused: boolean
}

function getSourceName(sourceId: string): string {
  return sourceId.replace(/_/g, ' ')
}

// Truncate long source labels for chart display
function truncateLabel(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(2)}`
}

export function VisionSection({ snapshots, latest, loading }: SectionProps) {
  const [batches, setBatches] = useState<BatchData[]>([])
  const [batchLoading, setBatchLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchBatches() {
      try {
        const res = await fetch('/api/vision/batches')
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        if (!cancelled) setBatches(data.batches ?? [])
      } catch {
        if (!cancelled) setBatches([])
      } finally {
        if (!cancelled) setBatchLoading(false)
      }
    }
    fetchBatches()
    return () => { cancelled = true }
  }, [])

  const activityData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        orders_processed: s.orders_processed_last_60s,
      })),
    [snapshots]
  )

  // --- Card 1: Batch Volume stats ---
  const batchStats = useMemo(() => {
    const active = batches.filter((b) => !b.paused).length
    const paused = batches.filter((b) => b.paused).length
    const totalPlayers = batches.reduce((sum, b) => sum + b.player_count, 0)
    return { active, paused, totalPlayers, total: batches.length }
  }, [batches])

  // --- Card 2: Pool Stats ---
  const poolStats = useMemo(() => {
    const totalTvlWei = batches.reduce((sum, b) => sum + Number(BigInt(b.tvl || '0')), 0)
    const totalTvl = totalTvlWei / 1e18
    const avgPlayers = batches.length > 0 ? batches.reduce((s, b) => s + b.player_count, 0) / batches.length : 0

    // Top 5 sources by TVL
    const tvlBySource: Record<string, number> = {}
    for (const b of batches) {
      const sid = b.source_id
      tvlBySource[sid] = (tvlBySource[sid] ?? 0) + Number(BigInt(b.tvl || '0')) / 1e18
    }
    const top5 = Object.entries(tvlBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, tvl]) => ({
        source: truncateLabel(getSourceName(source)),
        fullName: getSourceName(source),
        tvl,
      }))

    return { totalTvl, avgPlayers, top5 }
  }, [batches])

  // --- Card 3: Settlement Outcomes (batches per source) ---
  const sourceBreakdown = useMemo(() => {
    const countBySource: Record<string, number> = {}
    for (const b of batches) {
      countBySource[b.source_id] = (countBySource[b.source_id] ?? 0) + 1
    }
    return Object.entries(countBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([source, count]) => ({
        source: truncateLabel(getSourceName(source), 16),
        fullName: getSourceName(source),
        count,
      }))
  }, [batches])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Card 1: Batch Volume — live stat card */}
      <ExplorerChartCard title="Batch Volume" subtitle="Active batches and total players" loading={batchLoading}>
        <div className="h-full flex flex-col justify-center gap-5 px-2">
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label="Active Batches" value={batchStats.active} />
            <StatBlock label="Paused" value={batchStats.paused} />
            <StatBlock label="Total Players" value={batchStats.totalPlayers} />
          </div>
          <div className="border-t border-border-light pt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-black text-black tracking-tight">{batchStats.total}</span>
              <span className="text-[12px] text-text-muted">total batches</span>
            </div>
            <div className="mt-1.5 flex gap-4">
              <MiniBar label="Active" value={batchStats.active} total={batchStats.total} color="#000" />
              <MiniBar label="Paused" value={batchStats.paused} total={batchStats.total} color="#d1d5db" />
            </div>
          </div>
        </div>
      </ExplorerChartCard>

      {/* Card 2: Pool Stats — TVL, avg players, top 5 sources */}
      <ExplorerChartCard title="Batch Pool Stats" subtitle="TVL and top sources" loading={batchLoading}>
        <div className="h-full flex flex-col">
          <div className="flex items-baseline gap-3 mb-3">
            <div>
              <span className="text-[11px] text-text-muted block">Total TVL</span>
              <span className="text-[20px] font-black text-black tracking-tight">{formatTvl(poolStats.totalTvl)}</span>
            </div>
            <div className="ml-auto text-right">
              <span className="text-[11px] text-text-muted block">Avg Players / Batch</span>
              <span className="text-[16px] font-bold text-black">{poolStats.avgPlayers.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {poolStats.top5.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={poolStats.top5}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#999' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatTvl(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    tick={{ fontSize: 10, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e5e5' }}
                    formatter={(v: number, _: string, entry: any) => [formatTvl(v), entry.payload.fullName]}
                    labelFormatter={() => ''}
                  />
                  <Bar dataKey="tvl" radius={[0, 3, 3, 0]} maxBarSize={16}>
                    {poolStats.top5.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#000' : '#888'} fillOpacity={1 - i * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[12px] text-text-muted">No batch data available</p>
              </div>
            )}
          </div>
        </div>
      </ExplorerChartCard>

      {/* Card 3: Batches by Source — horizontal bar chart */}
      <ExplorerChartCard title="Batches by Source" subtitle="Number of batches per data source" loading={batchLoading}>
        <div className="h-full">
          {sourceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sourceBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fontSize: 9, fill: '#666' }}
                  tickLine={false}
                  axisLine={false}
                  width={95}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e5e5' }}
                  formatter={(v: number, _: string, entry: any) => [`${v} batch${v !== 1 ? 'es' : ''}`, entry.payload.fullName]}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={14}>
                  {sourceBreakdown.map((_, i) => (
                    <Cell key={i} fill="#000" fillOpacity={Math.max(0.3, 1 - i * 0.06)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[12px] text-text-muted">No batch data available</p>
            </div>
          )}
        </div>
      </ExplorerChartCard>

      {/* Derived chart: Network Activity */}
      <ExplorerChartCard
        title="Network Activity"
        subtitle="Orders processed per 60s — proxy for Vision order flow"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="orders_processed"
              name="Orders / 60s"
              stroke="#000"
              fill="#000"
              fillOpacity={0.08}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>
    </div>
  )
}

// --- Helper components ---

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/[0.03] rounded-lg px-3 py-2.5 text-center">
      <div className="text-[20px] font-black text-black tracking-tight leading-none">{value}</div>
      <div className="text-[10px] text-text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}

function MiniBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted">{label}</span>
        <span className="text-[10px] font-medium text-black">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
