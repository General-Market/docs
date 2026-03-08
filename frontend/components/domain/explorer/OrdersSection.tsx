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

export function OrdersSection({ snapshots, latest, loading }: SectionProps) {
  const ordersProcessedDeltas = useMemo(
    () => computeDeltas(snapshots, 'orders_processed_last_60s'),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-[18px] font-bold text-black mb-4">Orders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Pending Orders */}
        <ExplorerChartCard
          title="Pending Orders"
          subtitle={
            latest
              ? `Current: ${latest.pending_order_count}`
              : undefined
          }
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshots}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...xAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, 'Pending']}
              />
              <Area
                type="monotone"
                dataKey="pending_order_count"
                stroke="#000"
                fill="#000"
                fillOpacity={0.06}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 2. Orders Processed/min */}
        <ExplorerChartCard
          title="Orders Processed/min"
          subtitle="Delta between consecutive snapshots"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ordersProcessedDeltas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis {...deltaXAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, 'Processed']}
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

        {/* 3. Avg Cycle Duration */}
        <ExplorerChartCard
          title="Avg Cycle Duration"
          subtitle={
            latest
              ? `Current: ${(latest.avg_cycle_duration_ms ?? 0).toFixed(0)}ms`
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
                dataKey="avg_cycle_duration_ms"
                stroke="#000"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Placeholder for per-order data graphs */}
        <ExplorerChartCard
          title="Per-Order Metrics"
          subtitle="Graphs #18-30 from propositions"
          loading={false}
        >
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-[12px] text-text-muted leading-relaxed">
              Order-level metrics (fill rates, slippage, execution time per
              order type) require per-order data not available from the
              aggregated /health endpoint. These charts will be added when the
              issuer exposes order-level telemetry.
            </p>
          </div>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
