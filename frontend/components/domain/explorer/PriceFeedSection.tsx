'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
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

export function PriceFeedSection({ snapshots, latest, loading }: SectionProps) {
  return (
    <section>
      <h2 className="text-[18px] font-bold text-black mb-4">Price Feeds</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Consensus Duration Trend — proxy for price consensus overhead */}
        <ExplorerChartCard
          title="Consensus Duration Trend"
          subtitle={
            latest
              ? `Current: ${(latest.avg_consensus_time_ms ?? 0).toFixed(0)}ms`
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
                stroke="#6b7280"
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
