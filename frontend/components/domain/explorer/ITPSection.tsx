'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
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

export function ITPSection({ snapshots, latest, loading }: SectionProps) {
  const pendingOrderData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        pending: s.pending_order_count,
      })),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-[16px] font-black tracking-[-0.02em] text-black mb-4">ITP Metrics</h2>

      {/* Section-level notice */}
      <div className="bg-white border border-border-light rounded-card p-4 mb-4">
        <p className="text-[12px] text-text-muted">
          ITP-specific metrics (NAV tracking, inventory drift, rebalance events) require on-chain reads and are not yet available from /health snapshots. The chart below uses pending order count as a proxy for pipeline activity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Order Volume */}
        <ExplorerChartCard title="Pending Order Volume" subtitle="Pipeline activity proxy" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pendingOrderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="pending" stroke="#000" fill="#000" fillOpacity={0.08} name="Pending Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Placeholder for ITP chain data */}
        <ExplorerChartCard title="ITP On-Chain Metrics" loading={loading}>
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-text-muted text-center px-4">
              NAV tracking, inventory drift, rebalance history, and per-ITP performance will be sourced from on-chain data in a future update.
            </p>
          </div>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
