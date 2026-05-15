'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'

interface ExplorerHeartbeatProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function Sparkline({ values, status }: { values: number[]; status: 'healthy' | 'degraded' | 'unhealthy' }) {
  if (values.length < 2) return null
  const width = 72
  const height = 18
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const d = `M ${points.join(' L ')}`
  const color =
    status === 'healthy' ? '#1F8F4D' : status === 'degraded' ? '#B25600' : '#D70015'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ExplorerHeartbeat({ snapshots, latest }: ExplorerHeartbeatProps) {
  const now = useNow(1000)

  const lastUpdateMs = latest ? now - new Date(latest.poll_batch_ts).getTime() : 0
  const isStale = lastUpdateMs > 90_000

  // Oracles: total_peers = K*(K-1), solve for K
  const oracleCount = latest
    ? Math.round((1 + Math.sqrt(1 + 4 * latest.total_peers)) / 2)
    : 0

  // Rounds/min from the most recent two snapshots
  const roundsPerMin = useMemo(() => {
    if (snapshots.length < 2) return 0
    const last = snapshots[snapshots.length - 1]
    const prev = snapshots[snapshots.length - 2]
    const dt = (new Date(last.poll_batch_ts).getTime() - new Date(prev.poll_batch_ts).getTime()) / 60_000
    if (dt <= 0) return 0
    const dr = last.consensus_rounds_total - prev.consensus_rounds_total
    return Math.max(0, Math.round(dr / dt))
  }, [snapshots])

  // Sparkline: last 30 rounds-total values
  const sparkValues = useMemo(() => {
    return snapshots.slice(-30).map((s) => s.consensus_rounds_total)
  }, [snapshots])

  const status: 'healthy' | 'degraded' | 'unhealthy' =
    isStale ? 'unhealthy' : (latest?.worst_status as 'healthy' | 'degraded' | 'unhealthy') ?? 'healthy'

  const dotColor =
    status === 'healthy' ? '#1F8F4D' : status === 'degraded' ? '#B25600' : '#D70015'

  return (
    <div className="explorer-heartbeat flex flex-wrap items-center gap-x-3 gap-y-2 text-caption tracking-apple-tight text-[#6e6e73]">
      {/* Live pill */}
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-apple-pill bg-black/[0.04]">
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 heartbeat-ring"
            style={{ backgroundColor: dotColor }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full heartbeat-dot"
            style={{ backgroundColor: dotColor }}
          />
        </span>
        <span className="text-[11px] font-semibold tracking-apple-loose uppercase text-[#1d1d1f]">
          {isStale ? 'Stale' : 'Live'}
        </span>
      </span>

      {/* Metrics */}
      <span className="tabular-nums">
        <span className="text-[#86868b]">Refreshed </span>
        <span className="text-[#1d1d1f] font-medium">{latest ? formatAgo(lastUpdateMs) : '—'}</span>
      </span>

      <span className="text-[#D2D2D7]">·</span>

      <span className="tabular-nums">
        <span className="text-[#1d1d1f] font-medium">{oracleCount}</span>
        <span className="text-[#86868b]"> oracles</span>
      </span>

      <span className="text-[#D2D2D7]">·</span>

      <span className="inline-flex items-center gap-2 tabular-nums">
        <span>
          <span className="text-[#1d1d1f] font-medium">{roundsPerMin}</span>
          <span className="text-[#86868b]"> rounds/min</span>
        </span>
        {sparkValues.length >= 2 && (
          <span className="explorer-heartbeat-spark">
            <Sparkline values={sparkValues} status={status} />
          </span>
        )}
      </span>

      <span className="text-[#D2D2D7]">·</span>

      <span className="tabular-nums">
        <span className="text-[#1d1d1f] font-medium">{latest?.consensus_rounds_total.toLocaleString() ?? '—'}</span>
        <span className="text-[#86868b]"> total</span>
      </span>
    </div>
  )
}
