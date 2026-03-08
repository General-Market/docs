'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { computeDeltas } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const STATUS_MAP: Record<string, number> = {
  healthy: 1,
  degraded: 2,
  unhealthy: 3,
}

const STATUS_LABELS: Record<number, string> = {
  1: 'Healthy',
  2: 'Degraded',
  3: 'Unhealthy',
}

export function SystemHealthSection({ snapshots, latest, loading }: SectionProps) {
  const statusData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        status: STATUS_MAP[s.worst_status] ?? 3,
      })),
    [snapshots]
  )

  const quorumData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        quorum: s.quorum_met ? 1 : 0,
      })),
    [snapshots]
  )

  const successRateData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        rate:
          s.consensus_rounds_total > 0
            ? Math.round((s.consensus_success_total / s.consensus_rounds_total) * 10000) / 100
            : 0,
      })),
    [snapshots]
  )

  const errorRateData = useMemo(
    () => computeDeltas(snapshots, 'consensus_failed_total'),
    [snapshots]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* #82: Network Status */}
      <ExplorerChartCard
        title="Network Status"
        subtitle="Aggregate worst status (1=healthy, 2=degraded, 3=unhealthy)"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <YAxis
              domain={[0.5, 3.5]}
              ticks={[1, 2, 3]}
              tickFormatter={(v) => STATUS_LABELS[v] ?? ''}
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [STATUS_LABELS[value] ?? value, 'Status']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <defs>
              <linearGradient id="statusGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <Area
              type="stepAfter"
              dataKey="status"
              name="Status"
              stroke="#6b7280"
              fill="url(#statusGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* #83: Quorum History */}
      <ExplorerChartCard
        title="Quorum History"
        subtitle="Whether quorum was met at each poll"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={quorumData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <YAxis
              domain={[-0.1, 1.1]}
              ticks={[0, 1]}
              tickFormatter={(v) => (v === 1 ? 'Met' : 'Lost')}
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [value === 1 ? 'Quorum Met' : 'Quorum Lost', 'Quorum']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <defs>
              <linearGradient id="quorumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="stepAfter"
              dataKey="quorum"
              name="Quorum"
              stroke="#10b981"
              fill="url(#quorumGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* #84: Consensus Success Rate */}
      <ExplorerChartCard
        title="Consensus Success Rate"
        subtitle="Cumulative success / total rounds (%)"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={successRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [`${value}%`, 'Success Rate']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              name="Success Rate"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* #85: Error Rate */}
      <ExplorerChartCard
        title="Error Rate"
        subtitle="New consensus failures between polls"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={errorRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#ccc"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [value, 'Failures']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="delta"
              name="Failures"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>
    </div>
  )
}
