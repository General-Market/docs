'use client'

import { useTranslations } from 'next-intl'
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
  stroke: '#D2D2D7',
}

export function PriceFeedSection({ snapshots, latest, loading }: SectionProps) {
  const t = useTranslations('pages')

  return (
    <section>
      <h2 className="text-heading font-display font-semibold tracking-apple-tighter text-[#1d1d1f] mb-4">{t('explorer.price_feed_section.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Consensus Duration Trend — proxy for price consensus overhead */}
        <ExplorerChartCard
          title={t('explorer.price_feed_section.consensus_duration_trend')}
          subtitle={
            latest
              ? t('explorer.price_feed_section.current', { time: (latest.avg_consensus_time_ms ?? 0).toFixed(0) })
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
                formatter={(v: number) => [`${v.toFixed(0)}ms`, t('explorer.price_feed_section.duration')]}
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
