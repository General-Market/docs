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
import { AggregatedSnapshot, computeDeltas } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const timeTickFormatter = (v: string) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const xAxisProps = {
  dataKey: 'poll_batch_ts' as const,
  tickFormatter: timeTickFormatter,
  tick: { fontSize: 10 },
  stroke: '#ccc',
}

const deltaXAxisProps = {
  dataKey: 'time' as const,
  tickFormatter: timeTickFormatter,
  tick: { fontSize: 10 },
  stroke: '#ccc',
}

const STATUS_MAP: Record<string, number> = {
  healthy: 1,
  degraded: 2,
  unhealthy: 3,
}

export function ConsensusSection({ snapshots, latest, loading }: SectionProps) {
  const quorumData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        value: s.quorum_met ? 1 : 0,
      })),
    [snapshots]
  )

  const healthData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        value: STATUS_MAP[s.worst_status] ?? 3,
      })),
    [snapshots]
  )

  const roundsPerMin = useMemo(
    () => computeDeltas(snapshots, 'consensus_rounds_total'),
    [snapshots]
  )

  const successRateData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        rate:
          s.consensus_rounds_total > 0
            ? Math.round(
                (s.consensus_success_total / s.consensus_rounds_total) * 100
              )
            : 100,
      })),
    [snapshots]
  )

  const sigDeltas = useMemo(
    () => computeDeltas(snapshots, 'signatures_collected'),
    [snapshots]
  )

  const failedDeltas = useMemo(
    () => computeDeltas(snapshots, 'consensus_failed_total'),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black mb-4">Consensus</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Quorum Status */}
        <ExplorerChartCard
          title="Quorum Status"
          subtitle={
            latest
              ? `Currently: ${latest.quorum_met ? 'Met' : 'Not met'}`
              : undefined
          }
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={quorumData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...xAxisProps} />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 1]}
                tickFormatter={(v) => (v === 1 ? 'Yes' : 'No')}
                tick={{ fontSize: 10 }}
                stroke="#ccc"
                width={32}
              />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v === 1 ? 'Met' : 'Not met', 'Quorum']}
              />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 2. Network Health */}
        <ExplorerChartCard
          title="Network Health"
          subtitle={
            latest ? `Worst status: ${latest.worst_status}` : undefined
          }
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={healthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...xAxisProps} />
              <YAxis
                domain={[1, 3]}
                ticks={[1, 2, 3]}
                tickFormatter={(v) =>
                  v === 1 ? 'OK' : v === 2 ? 'Deg' : 'Bad'
                }
                tick={{ fontSize: 10 }}
                stroke="#ccc"
                width={32}
                reversed
              />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => {
                  const label =
                    v === 1
                      ? 'Healthy'
                      : v === 2
                        ? 'Degraded'
                        : 'Unhealthy'
                  return [label, 'Status']
                }}
              />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="#000"
                fill="#000"
                fillOpacity={0.05}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 3. Consensus Rounds/min */}
        <ExplorerChartCard
          title="Consensus Rounds/min"
          subtitle="Delta between consecutive snapshots"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={roundsPerMin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...deltaXAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, 'Rounds']}
              />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#000"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 4. Consensus Success Rate */}
        <ExplorerChartCard
          title="Consensus Success Rate"
          subtitle="Cumulative success / total rounds (%)"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={successRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...xAxisProps} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                stroke="#ccc"
                width={40}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [`${v}%`, 'Success']}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 5. Avg Consensus Duration */}
        <ExplorerChartCard
          title="Avg Consensus Duration"
          subtitle={
            latest
              ? `Current: ${latest.avg_consensus_time_ms.toFixed(0)}ms`
              : undefined
          }
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshots}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...xAxisProps} />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="#ccc"
                width={48}
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [`${v.toFixed(0)}ms`, 'Duration']}
              />
              <Line
                type="monotone"
                dataKey="avg_consensus_time_ms"
                stroke="#000"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 6. Signatures Collected */}
        <ExplorerChartCard
          title="Signatures Collected"
          subtitle="Delta between consecutive snapshots"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sigDeltas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...deltaXAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, 'Signatures']}
              />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#000"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 7. Failed Rounds */}
        <ExplorerChartCard
          title="Failed Rounds"
          subtitle="Delta between consecutive snapshots"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={failedDeltas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...deltaXAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, 'Failures']}
              />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#ef4444"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
