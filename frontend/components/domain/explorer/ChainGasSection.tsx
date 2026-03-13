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

const deltaXAxisProps = {
  dataKey: 'time' as const,
  tickFormatter: timeTickFormatter,
  tick: { fontSize: 10 },
  stroke: '#ccc',
}

export function ChainGasSection({ snapshots, latest, loading }: SectionProps) {
  const cycleData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        cycle_ms: s.avg_cycle_duration_ms,
      })),
    [snapshots]
  )

  const consensusDeltas = useMemo(
    () => computeDeltas(snapshots, 'consensus_rounds_total'),
    [snapshots]
  )

  const messageData = useMemo(() => {
    const sentDeltas = computeDeltas(snapshots, 'p2p_messages_sent')
    const recvDeltas = computeDeltas(snapshots, 'p2p_messages_received')
    const recvMap = new Map(recvDeltas.map((d) => [d.time, d.delta]))
    return sentDeltas.map((d) => ({
      time: d.time,
      sent: d.delta,
      received: recvMap.get(d.time) ?? 0,
    }))
  }, [snapshots])

  const orderPipelineData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        processed: s.orders_processed_last_60s,
        pending: s.pending_order_count,
      })),
    [snapshots]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Consensus Throughput */}
      <ExplorerChartCard
        title="Consensus Throughput"
        subtitle="Consensus rounds per interval (delta)"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={consensusDeltas}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...deltaXAxisProps} />
            <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [value, 'Rounds']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="delta"
              name="Rounds"
              stroke="#000"
              fill="#000"
              fillOpacity={0.06}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* Message Volume */}
      <ExplorerChartCard
        title="Message Volume"
        subtitle="P2P messages sent & received (delta per interval)"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={messageData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...deltaXAxisProps} />
            <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="sent"
              name="Sent"
              stroke="#000"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="received"
              name="Received"
              stroke="#000"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* Order Pipeline */}
      <ExplorerChartCard
        title="Order Pipeline"
        subtitle="Orders processed (last 60s) vs pending queue depth"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={orderPipelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tickFormatter={timeTickFormatter}
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
              dataKey="processed"
              name="Processed / 60s"
              stroke="#000"
              fill="#000"
              fillOpacity={0.08}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="pending"
              name="Pending"
              stroke="#666"
              fill="#666"
              fillOpacity={0.05}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* Derived chart: Cycle Performance */}
      <ExplorerChartCard
        title="Cycle Performance"
        subtitle="Average cycle duration (ms) — indicator of chain latency"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cycleData}>
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
              tick={{ fontSize: 10 }}
              stroke="#ccc"
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [`${value}ms`, 'Cycle Duration']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="cycle_ms"
              name="Cycle Duration"
              stroke="#000"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>
    </div>
  )
}
