'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

export function ChainGasSection({ snapshots, latest, loading }: SectionProps) {
  const cycleData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        cycle_ms: s.avg_cycle_duration_ms,
      })),
    [snapshots]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Placeholder: Gas Usage */}
      <ExplorerChartCard title="Gas Usage" subtitle="Per-transaction gas consumed" loading={loading}>
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
              <path
                d="M6 16V7a2 2 0 012-2h4a2 2 0 012 2v9M4 16h12M14 8l2-1v5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
              />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-black">Gas Tracking</p>
          <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
            Gas usage metrics require transaction receipt data from both L3 and settlement chains. These will be available once gas tracking is implemented in the issuer health collector.
          </p>
        </div>
      </ExplorerChartCard>

      {/* Placeholder: Gas Price History */}
      <ExplorerChartCard title="Gas Price History" subtitle="Base fee over time" loading={loading}>
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
              <path
                d="M3 14l4-4 3 2 7-8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
              />
              <path d="M13 4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-black">Base Fee Trends</p>
          <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
            Gas price history from L3 block headers will be tracked once on-chain reads are integrated into the health collector pipeline.
          </p>
        </div>
      </ExplorerChartCard>

      {/* Placeholder: Transaction Throughput */}
      <ExplorerChartCard title="Transaction Throughput" subtitle="Txns per block / per minute" loading={loading}>
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
              <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-black">Chain Throughput</p>
          <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
            Block-level transaction throughput requires periodic on-chain block reads. This metric will be added when chain monitoring is implemented.
          </p>
        </div>
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
