'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { formatUnits } from 'viem'
import { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'
import { useSSENav } from '@/hooks/useSSE'
import { useDtfMetrics } from '@/hooks/useDtfMetrics'
import type { TimeRange } from '@/hooks/useExplorerHealth'
import { NavSparklineGrid } from './NavSparklineGrid'
import { SharpeFrontierChart } from './SharpeFrontierChart'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
  range: TimeRange
}

const timeTickFormatter = (v: string) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const hourTickFormatter = (v: string) => {
  const d = new Date(v)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}`
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
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

// USDC on settlement is 6 decimals; loan amounts (Borrow/Repay) are 6 decimals
// too because the loan token is WUSDC. Buy/sell trade fill_amount is in L3
// USDC units which are 18 decimals. We surface USD with the right divisor
// per series.
function toUsd(raw: string, decimals: number): number {
  if (!raw || raw === '0') return 0
  try {
    return Number(formatUnits(BigInt(raw), decimals))
  } catch {
    return 0
  }
}

export function ITPSection({ snapshots: _snapshots, latest: _latest, loading: _loading, range }: SectionProps) {
  const t = useTranslations('pages')
  const navListRaw = useSSENav()
  const dtf = useDtfMetrics(range)

  // Drop spam ITPs (empty name or symbol) — defense in depth even if the
  // data-node filter regresses. The permissionless createITP entrypoint
  // on L3 is open to bots; legitimate funds always carry name + symbol.
  const navList = useMemo(
    () => navListRaw.filter((n) => (n.name?.trim() ?? '') !== '' && (n.symbol?.trim() ?? '') !== ''),
    [navListRaw],
  )

  // Top 5 by AUM — keeps ITP Overview table within the 200px card body
  const topItps = useMemo(() => {
    return [...navList]
      .sort((a, b) => (b.aum_usd || 0) - (a.aum_usd || 0))
      .slice(0, 5)
  }, [navList])

  // Summary stats
  const stats = useMemo(() => {
    const totalAum = navList.reduce((sum, n) => sum + (n.aum_usd || 0), 0)
    const withSupply = navList.filter(n => BigInt(n.total_supply || '0') > 0n).length
    return { total: navList.length, withSupply, totalAum }
  }, [navList])

  // --- Fills chart: buy/sell/borrow/lend USD volume ---
  // Buys/sells are L3-side fills (18 dec). Borrow/lend are WUSDC (6 dec) on L3.
  const fillsData = useMemo(
    () =>
      dtf.fills.map((b) => ({
        time: b.bucket,
        buy: toUsd(b.buy_amount, 18),
        sell: toUsd(b.sell_amount, 18),
        borrow: toUsd(b.borrow_amount, 6),
        lend: toUsd(b.supply_amount, 6),
      })),
    [dtf.fills],
  )
  const fillsHasSignal = useMemo(
    () => fillsData.some((d) => d.buy + d.sell + d.borrow + d.lend > 0),
    [fillsData],
  )

  // --- Order lifecycle: placed vs filled vs cancelled per bucket ---
  const lifecycleData = useMemo(
    () =>
      dtf.lifecycle.map((b) => ({
        time: b.bucket,
        placed: b.placed,
        filled: b.filled,
        cancelled: b.cancelled,
      })),
    [dtf.lifecycle],
  )
  const lifecycleHasSignal = useMemo(
    () => lifecycleData.some((d) => d.placed + d.filled + d.cancelled > 0),
    [lifecycleData],
  )

  // --- Global TVL ---
  const tvlData = useMemo(
    () => dtf.tvl.map((p) => ({ time: p.snapshot_ts, tvl: p.total_aum_usd })),
    [dtf.tvl],
  )
  const tvlLatest = tvlData.length > 0 ? tvlData[tvlData.length - 1].tvl : stats.totalAum

  // --- Orders per hour ---
  const ordersData = useMemo(
    () => dtf.ordersPerHour.map((b) => ({ time: b.bucket, count: b.count })),
    [dtf.ordersPerHour],
  )
  const ordersHasSignal = useMemo(
    () => ordersData.some((d) => d.count > 0),
    [ordersData],
  )

  const itpLoading = navList.length === 0

  return (
    <section>
      <h2 className="text-subhead font-display font-semibold tracking-apple-tighter text-[#1d1d1f] mb-4">{t('explorer.itp_section.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fills — buy/sell/borrow/lend USD volume per bucket */}
        <ExplorerChartCard
          title="Fills"
          subtitle="Buy, sell, borrow, lend volume"
          loading={dtf.loading}
        >
          {fillsHasSignal ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fillsData} stackOffset="none">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
                <XAxis dataKey="time" tickFormatter={timeTickFormatter} tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" tickFormatter={(v) => formatUsd(v)} width={56} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleString()}
                  formatter={(v: number, n) => [formatUsd(v), n]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="buy" stackId="1" stroke="#1F8F4D" fill="#1F8F4D" fillOpacity={0.25} name="Buy" />
                <Area type="monotone" dataKey="sell" stackId="1" stroke="#D70015" fill="#D70015" fillOpacity={0.25} name="Sell" />
                <Area type="monotone" dataKey="borrow" stackId="1" stroke="#0071E3" fill="#0071E3" fillOpacity={0.20} name="Borrow" />
                <Area type="monotone" dataKey="lend" stackId="1" stroke="#7B61FF" fill="#7B61FF" fillOpacity={0.20} name="Lend" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No fills in this window" />
          )}
        </ExplorerChartCard>

        {/* Order lifecycle — placed vs filled vs cancelled */}
        <ExplorerChartCard
          title="Order Lifecycle"
          subtitle="Placed, filled, cancelled per bucket"
          loading={dtf.loading}
        >
          {lifecycleHasSignal ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lifecycleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
                <XAxis dataKey="time" tickFormatter={timeTickFormatter} tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" allowDecimals={false} width={32} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleString()}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="placed"    stroke="#0071E3" strokeWidth={1.5} dot={false} name="Placed" />
                <Line type="monotone" dataKey="filled"    stroke="#1F8F4D" strokeWidth={1.5} dot={false} name="Filled" />
                <Line type="monotone" dataKey="cancelled" stroke="#86868b" strokeWidth={1.5} dot={false} name="Cancelled" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No orders in this window" />
          )}
        </ExplorerChartCard>

        {/* Global TVL */}
        <ExplorerChartCard
          title="Global TVL"
          subtitle={tvlData.length > 0 ? `Now: ${formatUsd(tvlLatest)}` : 'Protocol-wide AUM'}
          loading={dtf.loading}
        >
          {tvlData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tvlData}>
                <defs>
                  <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0071E3" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0071E3" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
                <XAxis dataKey="time" tickFormatter={timeTickFormatter} tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" tickFormatter={(v) => formatUsd(v)} width={56} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleString()}
                  formatter={(v: number) => [formatUsd(v), 'TVL']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area type="monotone" dataKey="tvl" stroke="#0071E3" strokeWidth={1.5} fill="url(#tvlFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="TVL collector warming up" />
          )}
        </ExplorerChartCard>

        {/* Orders per hour */}
        <ExplorerChartCard
          title="Orders per Hour"
          subtitle="OrderSubmitted bucketed by hour"
          loading={dtf.loading}
        >
          {ordersHasSignal ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
                <XAxis dataKey="time" tickFormatter={hourTickFormatter} tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" allowDecimals={false} width={32} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleString()}
                  formatter={(v: number) => [v, 'Orders']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#1d1d1f" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No orders in this window" />
          )}
        </ExplorerChartCard>

        {/* Live ITP Overview */}
        <ExplorerChartCard title={t('explorer.itp_section.overview')} subtitle={`${stats.total} ${t('explorer.itp_section.total_funds')}, ${stats.withSupply} ${t('explorer.itp_section.with_shares')}`} loading={itpLoading}>
          <div className="h-full flex flex-col">
            {/* Summary row */}
            <div className="flex items-baseline gap-4 mb-2 px-1">
              <div>
                <span className="text-micro text-[#86868b] block">{t('explorer.itp_section.total_funds')}</span>
                <span className="text-heading font-display font-semibold tracking-apple-tighter text-[#1d1d1f]">{stats.total}</span>
              </div>
              <div>
                <span className="text-micro text-[#86868b] block">{t('explorer.itp_section.total_aum')}</span>
                <span className="text-heading font-display font-semibold tracking-apple-tighter text-[#1d1d1f]">{formatUsd(stats.totalAum)}</span>
              </div>
              <div>
                <span className="text-micro text-[#86868b] block">{t('explorer.itp_section.with_shares')}</span>
                <span className="text-heading font-display font-semibold tracking-apple-tighter text-[#1d1d1f]">{stats.withSupply}</span>
              </div>
            </div>
            {/* Top ITPs table */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-micro font-semibold text-[#86868b] pb-1.5 pr-2">{t('explorer.itp_section.fund')}</th>
                    <th className="text-micro font-semibold text-[#86868b] pb-1.5 pr-2 text-right">{t('explorer.itp_section.nav')}</th>
                    <th className="text-micro font-semibold text-[#86868b] pb-1.5 pr-2 text-right">{t('explorer.itp_section.aum')}</th>
                    <th className="text-micro font-semibold text-[#86868b] pb-1.5 text-right">{t('explorer.itp_section.shares')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topItps.map((itp) => (
                    <tr key={itp.itp_id} className="border-b border-border-light last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="text-caption font-bold text-[#1d1d1f]">
                          {itp.symbol || itp.name || 'DTF'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className="text-caption font-mono text-[#1d1d1f]">
                          ${itp.nav_per_share.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className="text-label font-mono text-[#1d1d1f]">
                          {itp.aum_usd > 0 ? formatUsd(itp.aum_usd) : '--'}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="text-label font-mono text-[#86868b]">
                          {formatShares(itp.total_supply)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {topItps.length === 0 && !itpLoading && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-caption text-[#86868b]">
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-[#86868b]">
      <span className="text-caption">{label}</span>
    </div>
  )
}
