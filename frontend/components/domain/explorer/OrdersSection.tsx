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
import { FillLatencyChart } from './FillLatencyChart'

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
  stroke: '#D2D2D7',
}

const deltaXAxisProps = {
  dataKey: 'time' as const,
  tickFormatter: timeTickFormatter,
  tick: { fontSize: 10 },
  stroke: '#D2D2D7',
}

export function OrdersSection({ snapshots, latest, loading }: SectionProps) {
  const t = useTranslations('pages')
  const ordersProcessedDeltas = useMemo(
    () => computeDeltas(snapshots, 'orders_processed_last_60s'),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-heading font-display font-semibold tracking-apple-tighter text-[#1d1d1f] mb-4">{t('explorer.orders_section.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Pending Orders */}
        <ExplorerChartCard
          title={t('explorer.orders_section.pending')}
          subtitle={
            latest
              ? t('explorer.orders_section.current_count', { count: latest.pending_order_count })
              : undefined
          }
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshots}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
              <XAxis {...xAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, t('explorer.orders_tooltip.pending')]}
              />
              <Area
                type="monotone"
                dataKey="pending_order_count"
                stroke="#1d1d1f"
                fill="#1d1d1f"
                fillOpacity={0.06}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 2. Orders Processed/min */}
        <ExplorerChartCard
          title={t('explorer.orders_section.processed_per_min')}
          subtitle={t('explorer.orders_section.processed_desc')}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ordersProcessedDeltas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
              <XAxis {...deltaXAxisProps} />
              <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" width={40} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [v, t('explorer.orders_tooltip.processed')]}
              />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#1d1d1f"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 3. Avg Cycle Duration */}
        <ExplorerChartCard
          title={t('explorer.orders_section.avg_cycle')}
          subtitle={
            latest
              ? t('explorer.orders_section.current_time', { time: (latest.avg_cycle_duration_ms ?? 0).toFixed(0) })
              : undefined
          }
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshots}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
              <XAxis {...xAxisProps} />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="#D2D2D7"
                width={48}
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(v: number) => [`${v.toFixed(0)}ms`, t('explorer.orders_tooltip.duration')]}
              />
              <Line
                type="monotone"
                dataKey="avg_cycle_duration_ms"
                stroke="#1d1d1f"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* 4. Fill Latency Distribution */}
        <FillLatencyChart />

      </div>
    </section>
  )
}
