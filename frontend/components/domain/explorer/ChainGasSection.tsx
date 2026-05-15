'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  stroke: '#D2D2D7',
}

export function ChainGasSection({ snapshots, latest, loading }: SectionProps) {
  const t = useTranslations('pages')

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
        title={t('explorer.chain_gas_section.consensus_throughput')}
        subtitle={t('explorer.chain_gas_section.consensus_throughput_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={consensusDeltas}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis {...deltaXAxisProps} />
            <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [value, t('explorer.chain_gas_section.rounds')]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="delta"
              name={t('explorer.chain_gas_section.rounds')}
              stroke="#1d1d1f"
              fill="#1d1d1f"
              fillOpacity={0.06}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* Message Volume */}
      <ExplorerChartCard
        title={t('explorer.chain_gas_section.message_volume')}
        subtitle={t('explorer.chain_gas_section.message_volume_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={messageData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis {...deltaXAxisProps} />
            <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="sent"
              name={t('explorer.chain_gas_section.sent')}
              stroke="#1d1d1f"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="received"
              name={t('explorer.chain_gas_section.received')}
              stroke="#1d1d1f"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* Order Pipeline */}
      <ExplorerChartCard
        title={t('explorer.chain_gas_section.order_pipeline')}
        subtitle={t('explorer.chain_gas_section.order_pipeline_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={orderPipelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis
              dataKey="time"
              tickFormatter={timeTickFormatter}
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="processed"
              name={t('explorer.chain_gas_section.processed_60s')}
              stroke="#1d1d1f"
              fill="#1d1d1f"
              fillOpacity={0.08}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="pending"
              name={t('explorer.chain_gas_section.pending')}
              stroke="#86868b"
              fill="#86868b"
              fillOpacity={0.05}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* Derived chart: Cycle Performance */}
      <ExplorerChartCard
        title={t('explorer.chain_gas_section.cycle_performance')}
        subtitle={t('explorer.chain_gas_section.cycle_performance_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cycleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [`${value}ms`, t('explorer.chain_gas_section.cycle_duration')]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="cycle_ms"
              name={t('explorer.chain_gas_section.cycle_duration')}
              stroke="#1d1d1f"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>
    </div>
  )
}
