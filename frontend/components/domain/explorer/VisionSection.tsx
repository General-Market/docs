'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

export function VisionSection({ snapshots, latest, loading }: SectionProps) {
  const activityData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        orders_processed: s.orders_processed_last_60s,
      })),
    [snapshots]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Placeholder: Vision batch metrics */}
      <ExplorerChartCard title="Batch Volume" subtitle="Total batches processed" loading={loading}>
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
              <path d="M3 10h2v6H3zM8 6h2v10H8zM13 8h2v8h-2z" fill="currentColor" opacity="0.4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-black">Vision Batch Metrics</p>
          <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
            Vision batch volume, settlement, and pool data require on-chain reads from batch contract events. These metrics will be sourced once batch event indexing is implemented.
          </p>
        </div>
      </ExplorerChartCard>

      {/* Placeholder: Batch Pool Stats */}
      <ExplorerChartCard title="Batch Pool Stats" subtitle="Active pools and TVL" loading={loading}>
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-black">Pool Analytics</p>
          <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
            Pool-level metrics including TVL, participation rates, and settlement history will be available once on-chain batch event indexing is in place.
          </p>
        </div>
      </ExplorerChartCard>

      {/* Placeholder: Settlement Outcomes */}
      <ExplorerChartCard title="Settlement Outcomes" subtitle="Win/loss distribution" loading={loading}>
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
              <path d="M4 16l4-5 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-black">Settlement Data</p>
          <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
            Outcome distributions and settlement accuracy tracking require batch event data from the settlement chain.
          </p>
        </div>
      </ExplorerChartCard>

      {/* Derived chart: Network Activity */}
      <ExplorerChartCard
        title="Network Activity"
        subtitle="Orders processed per 60s — proxy for Vision order flow"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
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
              dataKey="orders_processed"
              name="Orders / 60s"
              stroke="#000"
              fill="#000"
              fillOpacity={0.08}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>
    </div>
  )
}
