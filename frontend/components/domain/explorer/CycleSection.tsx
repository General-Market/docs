'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const tickFormatter = (v: string) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function CycleSection({ snapshots, latest, loading }: SectionProps) {
  const t = useTranslations('pages')

  const cycleDurationData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        duration: s.avg_cycle_duration_ms,
      })),
    [snapshots]
  )

  const slowCycleCount = useMemo(
    () => snapshots.filter((s) => s.avg_cycle_duration_ms > 2000).length,
    [snapshots]
  )

  const ordersPerCycleData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        orders_per_cycle: Math.round((s.orders_processed_last_60s / 12) * 100) / 100,
      })),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-subhead font-black tracking-tight text-black mb-4">{t('explorer.cycle_section.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cycle Duration */}
        <ExplorerChartCard title={t('explorer.cycle_section.cycle_duration')} subtitle={t('explorer.cycle_section.cycle_duration_desc')} loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cycleDurationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" unit="ms" />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(value: number) => [`${value}ms`, t('explorer.cycle_section.duration')]}
                contentStyle={{ fontSize: 12 }}
              />
              <Line type="monotone" dataKey="duration" stroke="#000" strokeWidth={1.5} dot={false} name={t('explorer.cycle_section.duration')} />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Slow Cycle Alerts */}
        <ExplorerChartCard title={t('explorer.cycle_section.slow_cycle_alerts')} subtitle={t('explorer.cycle_section.slow_cycle_alerts_desc')} loading={loading}>
          <div className="h-full flex flex-col items-center justify-center">
            <p
              className={`text-[48px] font-black tracking-[-0.04em] ${
                slowCycleCount > 0 ? 'text-color-down' : 'text-color-up'
              }`}
            >
              {slowCycleCount}
            </p>
            <p className="text-caption text-text-muted mt-1">
              {t('explorer.cycle_section.out_of_snapshots', { count: snapshots.length })}
            </p>
          </div>
        </ExplorerChartCard>

        {/* Orders per Cycle */}
        <ExplorerChartCard
          title={t('explorer.cycle_section.orders_per_cycle')}
          subtitle={t('explorer.cycle_section.orders_per_cycle_desc')}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ordersPerCycleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="orders_per_cycle"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                name={t('explorer.cycle_section.orders_cycle')}
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

      </div>
    </section>
  )
}
