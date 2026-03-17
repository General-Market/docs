'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { formatUnits } from 'viem'
import { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const tickFormatter = (v: string) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  if (value >= 0.01) return `$${value.toFixed(2)}`
  return '$0'
}

function formatShares(supply: string): string {
  const n = parseFloat(formatUnits(BigInt(supply || '0'), 18))
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n > 0) return n.toFixed(2)
  return '0'
}

export function ITPSection({ snapshots, latest, loading }: SectionProps) {
  const navList = useSSENav()

  // Top 10 by AUM
  const topItps = useMemo(() => {
    return [...navList]
      .sort((a, b) => (b.aum_usd || 0) - (a.aum_usd || 0))
      .slice(0, 10)
  }, [navList])

  // Summary stats
  const stats = useMemo(() => {
    const totalAum = navList.reduce((sum, n) => sum + (n.aum_usd || 0), 0)
    const withSupply = navList.filter(n => BigInt(n.total_supply || '0') > 0n).length
    return { total: navList.length, withSupply, totalAum }
  }, [navList])

  const pendingOrderData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        pending: s.pending_order_count,
      })),
    [snapshots]
  )

  const itpLoading = navList.length === 0

  return (
    <section>
      <h2 className="text-[16px] font-black tracking-[-0.02em] text-black mb-4">ITP Metrics</h2>

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

        {/* Live ITP Overview */}
        <ExplorerChartCard title="ITP Overview" subtitle={`${stats.total} funds, ${stats.withSupply} with shares`} loading={itpLoading}>
          <div className="h-full flex flex-col">
            {/* Summary row */}
            <div className="flex items-baseline gap-4 mb-2 px-1">
              <div>
                <span className="text-[10px] text-text-muted block">Total Funds</span>
                <span className="text-[20px] font-black text-black">{stats.total}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Total AUM</span>
                <span className="text-[20px] font-black text-black">{formatUsd(stats.totalAum)}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">With Shares</span>
                <span className="text-[20px] font-black text-black">{stats.withSupply}</span>
              </div>
            </div>
            {/* Top ITPs table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-[10px] font-semibold text-text-muted pb-1.5 pr-2">Fund</th>
                    <th className="text-[10px] font-semibold text-text-muted pb-1.5 pr-2 text-right">NAV</th>
                    <th className="text-[10px] font-semibold text-text-muted pb-1.5 pr-2 text-right">AUM</th>
                    <th className="text-[10px] font-semibold text-text-muted pb-1.5 text-right">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {topItps.map((itp) => (
                    <tr key={itp.itp_id} className="border-b border-border-light last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="text-[12px] font-bold text-black">
                          {itp.symbol || itp.name || 'ITP'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className="text-[12px] font-mono text-black">
                          ${itp.nav_per_share.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className="text-[11px] font-mono text-black">
                          {itp.aum_usd > 0 ? formatUsd(itp.aum_usd) : '--'}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="text-[11px] font-mono text-text-muted">
                          {formatShares(itp.total_supply)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {topItps.length === 0 && !itpLoading && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[12px] text-text-muted">
                        No ITP data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
