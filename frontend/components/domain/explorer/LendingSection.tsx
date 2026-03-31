'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { formatUnits } from 'viem'
import { ExplorerChartCard } from '@/components/domain/explorer'
import { useSSEMorphoMarkets, useSSEMorphoVault, useSSENav, type MorphoMarketSSE } from '@/hooks/useSSE'
import {
  calculateUtilization,
  borrowRateToApy,
  MORPHO_CONSTANTS,
} from '@/lib/types/morpho'

interface SectionProps {
  loading: boolean
}

// ── Helpers ──

function toUsdc(raw: string): number {
  return parseFloat(formatUnits(BigInt(raw || '0'), 18))
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  if (v >= 0.01) return `$${v.toFixed(2)}`
  return '$0'
}

function formatPct(v: number): string {
  return `${v.toFixed(2)}%`
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const CHART_COLORS = [
  '#60a5fa', '#34d399', '#f472b6', '#fbbf24',
  '#a78bfa', '#fb923c', '#22d3ee', '#e879f9',
  '#4ade80', '#f87171', '#38bdf8', '#c084fc',
]

// ── Component ──

export function LendingSection({ loading }: SectionProps) {
  const t = useTranslations('pages')
  const markets = useSSEMorphoMarkets()
  const vault = useSSEMorphoVault()
  const navList = useSSENav()

  // Build a symbol lookup from collateral address → ITP symbol
  const symbolMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of navList) {
      if (n.settlement_address) {
        m.set(n.settlement_address.toLowerCase(), n.symbol || n.name || `ITP-${n.itp_id}`)
      }
    }
    return m
  }, [navList])

  const marketLabel = (mk: MorphoMarketSSE) =>
    symbolMap.get(mk.collateral_token.toLowerCase()) || truncAddr(mk.collateral_token)

  // ── Computed data ──

  const enriched = useMemo(() => {
    return markets.map((mk) => {
      const supply = toUsdc(mk.total_supply_assets)
      const borrowed = toUsdc(mk.total_borrow_assets)
      const util = calculateUtilization(BigInt(mk.total_borrow_assets || '0'), BigInt(mk.total_supply_assets || '0'))
      const apy = borrowRateToApy(BigInt(mk.borrow_rate_per_second || '0'))
      const label = marketLabel(mk)
      return { ...mk, supply, borrowed, util, apy, label }
    })
  }, [markets, symbolMap])

  const activeMarkets = useMemo(() => enriched.filter(m => m.supply > 0 || m.borrowed > 0), [enriched])

  // Aggregate stats
  const stats = useMemo(() => {
    const totalSupply = enriched.reduce((s, m) => s + m.supply, 0)
    const totalBorrowed = enriched.reduce((s, m) => s + m.borrowed, 0)
    const vaultAssets = vault ? toUsdc(vault.total_assets) : 0
    const tvl = totalSupply + vaultAssets
    const avgUtil = totalSupply > 0 ? (totalBorrowed / totalSupply) * 100 : 0
    const weightedApy = totalBorrowed > 0
      ? enriched.reduce((s, m) => s + m.apy * m.borrowed, 0) / totalBorrowed
      : 0
    return { totalSupply, totalBorrowed, vaultAssets, tvl, avgUtil, weightedApy, marketCount: markets.length, activeCount: activeMarkets.length }
  }, [enriched, activeMarkets, vault, markets.length])

  // Bar chart data: utilization per market
  const utilizationData = useMemo(() =>
    activeMarkets
      .sort((a, b) => b.util - a.util)
      .map(m => ({ name: m.label, utilization: parseFloat(m.util.toFixed(2)) })),
  [activeMarkets])

  // Bar chart data: borrow APY per market
  const apyData = useMemo(() =>
    activeMarkets
      .filter(m => m.apy > 0)
      .sort((a, b) => b.apy - a.apy)
      .map(m => ({ name: m.label, apy: parseFloat(m.apy.toFixed(2)) })),
  [activeMarkets])

  // Bar chart data: total borrowed per market
  const borrowedData = useMemo(() =>
    activeMarkets
      .filter(m => m.borrowed > 0)
      .sort((a, b) => b.borrowed - a.borrowed)
      .map(m => ({ name: m.label, borrowed: parseFloat(m.borrowed.toFixed(2)) })),
  [activeMarkets])

  // Bar chart data: supply per market
  const supplyData = useMemo(() =>
    activeMarkets
      .filter(m => m.supply > 0)
      .sort((a, b) => b.supply - a.supply)
      .map(m => ({ name: m.label, supply: parseFloat(m.supply.toFixed(2)) })),
  [activeMarkets])

  // Pie chart: collateral distribution
  const distributionData = useMemo(() =>
    activeMarkets
      .filter(m => m.supply > 0)
      .sort((a, b) => b.supply - a.supply)
      .map(m => ({ name: m.label, value: parseFloat(m.supply.toFixed(2)) })),
  [activeMarkets])

  const lendingLoading = markets.length === 0

  return (
    <section>
      <h2 className="text-subhead font-black tracking-tight text-white mb-4">
        {t('explorer.lending_section.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. TVL Overview */}
        <ExplorerChartCard
          title={t('explorer.lending_section.tvl')}
          subtitle={`${stats.marketCount} markets, ${stats.activeCount} active`}
          loading={lendingLoading}
        >
          <div className="h-full flex flex-col justify-center gap-4 px-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-micro text-white/40 block">Total Value Locked</span>
                <span className="text-heading font-black text-white">{formatUsd(stats.tvl)}</span>
              </div>
              <div>
                <span className="text-micro text-white/40 block">Vault Deposits</span>
                <span className="text-heading font-black text-white">{formatUsd(stats.vaultAssets)}</span>
              </div>
              <div>
                <span className="text-micro text-white/40 block">Total Supplied</span>
                <span className="text-heading font-black text-white">{formatUsd(stats.totalSupply)}</span>
              </div>
              <div>
                <span className="text-micro text-white/40 block">Total Borrowed</span>
                <span className="text-heading font-black text-white">{formatUsd(stats.totalBorrowed)}</span>
              </div>
            </div>
            <div className="flex items-baseline gap-6">
              <div>
                <span className="text-micro text-white/40 block">Avg Utilization</span>
                <span className="text-body font-bold text-white">{formatPct(stats.avgUtil)}</span>
              </div>
              <div>
                <span className="text-micro text-white/40 block">Wtd Avg Borrow APY</span>
                <span className="text-body font-bold text-white">{formatPct(stats.weightedApy)}</span>
              </div>
              {vault && (
                <div>
                  <span className="text-micro text-white/40 block">Vault</span>
                  <span className="text-body font-bold text-white">{vault.symbol || vault.name}</span>
                </div>
              )}
            </div>
          </div>
        </ExplorerChartCard>

        {/* 2. Utilization Rate per Market */}
        <ExplorerChartCard
          title={t('explorer.lending_section.utilization')}
          subtitle="Borrowed / Supplied per market"
          loading={lendingLoading}
        >
          {utilizationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#999' }} width={55} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}%`, 'Utilization']}
                  contentStyle={{ fontSize: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="utilization" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-caption">No active markets</div>
          )}
        </ExplorerChartCard>

        {/* 3. Borrow APY per Market */}
        <ExplorerChartCard
          title={t('explorer.lending_section.borrow_apy')}
          subtitle="Annualized borrow cost"
          loading={lendingLoading}
        >
          {apyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apyData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#999' }} width={55} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}%`, 'Borrow APY']}
                  contentStyle={{ fontSize: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="apy" fill="#f472b6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-caption">No borrow activity</div>
          )}
        </ExplorerChartCard>

        {/* 4. Borrowed Volume per Market */}
        <ExplorerChartCard
          title={t('explorer.lending_section.borrowed')}
          subtitle="Outstanding debt per market"
          loading={lendingLoading}
        >
          {borrowedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={borrowedData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={v => formatUsd(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#999' }} width={55} />
                <Tooltip
                  formatter={(v: number) => [formatUsd(v), 'Borrowed']}
                  contentStyle={{ fontSize: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="borrowed" fill="#fbbf24" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-caption">No outstanding debt</div>
          )}
        </ExplorerChartCard>

        {/* 5. Supply per Market */}
        <ExplorerChartCard
          title={t('explorer.lending_section.supply')}
          subtitle="Liquidity available per market"
          loading={lendingLoading}
        >
          {supplyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplyData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={v => formatUsd(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#999' }} width={55} />
                <Tooltip
                  formatter={(v: number) => [formatUsd(v), 'Supplied']}
                  contentStyle={{ fontSize: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="supply" fill="#34d399" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-caption">No supply data</div>
          )}
        </ExplorerChartCard>

        {/* 6. Market Distribution (Pie) */}
        <ExplorerChartCard
          title={t('explorer.lending_section.distribution')}
          subtitle="Supply distribution across ITP markets"
          loading={lendingLoading}
        >
          {distributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {distributionData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatUsd(v), 'Supplied']}
                  contentStyle={{ fontSize: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-caption">No market data</div>
          )}
        </ExplorerChartCard>

      </div>
    </section>
  )
}
