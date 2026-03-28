'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { formatUnits } from 'viem'
import { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'
import { NavSparklineGrid } from './NavSparklineGrid'
import { SharpeFrontierChart } from './SharpeFrontierChart'

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
  const t = useTranslations('pages')
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
      <h2 className="text-subhead font-black tracking-tight text-black mb-4">{t('explorer.itp_section.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Order Volume */}
        <ExplorerChartCard title={t('explorer.itp_section.pending_volume')} subtitle={t('explorer.itp_section.pipeline_proxy')} loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pendingOrderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="pending" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} name={t('explorer.orders_section.pending')} />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Live ITP Overview */}
        <ExplorerChartCard title={t('explorer.itp_section.overview')} subtitle={`${stats.total} ${t('explorer.itp_section.total_funds')}, ${stats.withSupply} ${t('explorer.itp_section.with_shares')}`} loading={itpLoading}>
          <div className="h-full flex flex-col">
            {/* Summary row */}
            <div className="flex items-baseline gap-4 mb-2 px-1">
              <div>
                <span className="text-micro text-text-muted block">{t('explorer.itp_section.total_funds')}</span>
                <span className="text-heading font-black text-black">{stats.total}</span>
              </div>
              <div>
                <span className="text-micro text-text-muted block">{t('explorer.itp_section.total_aum')}</span>
                <span className="text-heading font-black text-black">{formatUsd(stats.totalAum)}</span>
              </div>
              <div>
                <span className="text-micro text-text-muted block">{t('explorer.itp_section.with_shares')}</span>
                <span className="text-heading font-black text-black">{stats.withSupply}</span>
              </div>
            </div>
            {/* Top ITPs table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-micro font-semibold text-text-muted pb-1.5 pr-2">{t('explorer.itp_section.fund')}</th>
                    <th className="text-micro font-semibold text-text-muted pb-1.5 pr-2 text-right">{t('explorer.itp_section.nav')}</th>
                    <th className="text-micro font-semibold text-text-muted pb-1.5 pr-2 text-right">{t('explorer.itp_section.aum')}</th>
                    <th className="text-micro font-semibold text-text-muted pb-1.5 text-right">{t('explorer.itp_section.shares')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topItps.map((itp) => (
                    <tr key={itp.itp_id} className="border-b border-border-light last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="text-caption font-bold text-black">
                          {itp.symbol || itp.name || 'ITP'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className="text-caption font-mono text-black">
                          ${itp.nav_per_share.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className="text-label font-mono text-black">
                          {itp.aum_usd > 0 ? formatUsd(itp.aum_usd) : '--'}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="text-label font-mono text-text-muted">
                          {formatShares(itp.total_supply)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {topItps.length === 0 && !itpLoading && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-caption text-text-muted">
                        {t('explorer.itp_section.no_data')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ExplorerChartCard>
        {/* NAV Sparklines — 30d trend per ITP */}
        <NavSparklineGrid />

        {/* Sharpe Frontier — simulation scatter plot */}
        <SharpeFrontierChart />

      </div>
    </section>
  )
}
