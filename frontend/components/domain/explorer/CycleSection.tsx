'use client'

import { useMemo } from 'react'
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
      <h2 className="text-[16px] font-black tracking-[-0.02em] text-black mb-4">Cycle Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cycle Duration */}
        <ExplorerChartCard title="Cycle Duration" subtitle="Average cycle duration (ms)" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cycleDurationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" unit="ms" />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(value: number) => [`${value}ms`, 'Duration']}
                contentStyle={{ fontSize: 12 }}
              />
              <Line type="monotone" dataKey="duration" stroke="#000" strokeWidth={1.5} dot={false} name="Duration" />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Slow Cycle Alerts */}
        <ExplorerChartCard title="Slow Cycle Alerts" subtitle="Snapshots where avg cycle > 2000ms" loading={loading}>
          <div className="h-full flex flex-col items-center justify-center">
            <p
              className={`text-[48px] font-black tracking-[-0.04em] ${
                slowCycleCount > 0 ? 'text-color-down' : 'text-color-up'
              }`}
            >
              {slowCycleCount}
            </p>
            <p className="text-[12px] text-text-muted mt-1">
              out of {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </p>
          </div>
        </ExplorerChartCard>

        {/* Orders per Cycle */}
        <ExplorerChartCard
          title="Orders per Cycle"
          subtitle="Approximate (orders_processed_last_60s / 12)"
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
                name="Orders/Cycle"
              />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Placeholder for per-cycle granularity */}
        <ExplorerChartCard title="Per-Cycle Breakdown" loading={loading}>
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-text-muted text-center px-4">
              Per-cycle timing breakdowns, state-machine transitions, and cycle-level error rates require granularity not available in 5-minute snapshots.
            </p>
          </div>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
