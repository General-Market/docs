'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { useSSEOrders, useSSEBalances, useSSENav } from '@/hooks/useSSE'
import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/contracts/addresses'
import { indexL3 } from '@/lib/wagmi'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  TooltipProps,
} from 'recharts'
import { formatUnits, parseUnits } from 'viem'
import { usePortfolio, PortfolioHistoryPoint, PortfolioSummary, Position } from '@/hooks/usePortfolio'
import { DeployedItpRef } from '@/components/domain/ItpListing'
import { useTranslations } from 'next-intl'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { L3_EXPLORER_URL, SETTLEMENT_EXPLORER_URL } from '@/lib/config'

const PAGE_SIZE = 10

type Tab = 'value' | 'positions' | 'trades' | 'orders'

interface PortfolioSectionProps {
  expanded: boolean
  onToggle: () => void
  deployedItps?: DeployedItpRef[]
}

// --- Order types (from ActiveOrdersSection) ---
interface ActiveOrder {
  orderId: number
  user: string
  itpId: string
  side: number
  amount: bigint
  limitPrice: bigint
  status: number
  timestamp: number
}

const STATUS_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Batched',
  2: 'Filled',
  3: 'Cancelled',
  4: 'Expired',
}

const STATUS_COLORS: Record<number, string> = {
  0: 'text-yellow-600 bg-yellow-100',
  1: 'text-blue-600 bg-blue-100',
  2: 'text-color-up bg-green-50',
  3: 'text-color-down bg-red-50',
  4: 'text-text-muted bg-muted',
}

function PortfolioTooltip({ active, payload }: TooltipProps<number, string>) {
  const t = useTranslations('portfolio')
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as PortfolioHistoryPoint

  return (
    <div className="bg-card border border-border-light rounded-lg shadow-card p-3 text-sm">
      <p className="text-text-primary font-semibold mb-1">{data.date}</p>
      <div className="space-y-1 text-text-secondary">
        <p className="font-mono tabular-nums">{t('tooltip.value_label')} ${data.value.toFixed(2)}</p>
        <p className={`font-mono tabular-nums ${data.pnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
          {t('tooltip.pnl_label')} {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)} ({data.pnl_pct >= 0 ? '+' : ''}{data.pnl_pct.toFixed(1)}%)
        </p>
      </div>
    </div>
  )
}

export function PortfolioSection({ expanded, onToggle, deployedItps }: PortfolioSectionProps) {
  const t = useTranslations('portfolio')
  const tc = useTranslations('common')
  const { address } = useAccount()
  const { summary, history, trades, isLoading, refetch } = usePortfolio(address?.toLowerCase())
  const chainId = typeof window !== 'undefined' ? indexL3.id : undefined
  const isWrongNetwork = false // Header handles chain switching
  const { data: usdcRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const usdcNum = usdcRaw !== undefined ? Number(usdcRaw) / 10 ** USDC_DECIMALS : 0
  const usdcFormatted = usdcNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [activeTab, setActiveTab] = useState<Tab>('positions')

  // --- SSE balances & nav for real-time on-chain positions ---
  const sseBalances = useSSEBalances()
  const sseNav = useSSENav()

  // Build on-chain positions from SSE: merges with trade-based portfolio
  const mergedSummary = useMemo(() => {
    if (!summary && !sseBalances) return null

    // Start with trade-based positions from data-node
    const posMap = new Map<string, Position>()
    if (summary) {
      for (const pos of summary.positions) {
        posMap.set(pos.itp_id.toLowerCase(), pos)
      }
    }

    // Build NAV lookup from SSE
    const navMap = new Map<string, number>()
    for (const snap of sseNav) {
      navMap.set(snap.itp_id.toLowerCase(), snap.nav_per_share)
    }

    // Add/update positions from on-chain SSE balances
    if (sseBalances && sseBalances.itp_shares && typeof sseBalances.itp_shares === 'object') {
      for (const [itpId, sharesWei] of Object.entries(sseBalances.itp_shares)) {
        const key = itpId.toLowerCase()
        // Skip zero-address ITP entries (phantom entries from contract)
        if (/^0x0+$/.test(key) || key === '0') continue
        const shares = parseFloat(sharesWei) / 1e18
        if (shares <= 0) continue

        const nav = navMap.get(key) || 0
        const currentValue = shares * nav

        if (posMap.has(key)) {
          // Update existing position with on-chain shares (source of truth)
          const existing = posMap.get(key)!
          const avgCost = parseFloat(existing.avg_cost)
          const pnl = currentValue - (shares * avgCost)
          const pnlPct = avgCost > 0 ? ((nav / avgCost) - 1) * 100 : 0
          posMap.set(key, {
            ...existing,
            shares_bought: shares.toFixed(4),
            current_nav: nav.toFixed(6),
            current_value: currentValue.toFixed(2),
            pnl: pnl.toFixed(2),
            pnl_pct: pnlPct.toFixed(1),
          })
        } else {
          // New position not in trade history (e.g., received via transfer)
          posMap.set(key, {
            itp_id: itpId,
            shares_bought: shares.toFixed(4),
            shares_sold: '0.0000',
            avg_cost: nav.toFixed(6), // unknown cost basis, use current nav
            current_nav: nav.toFixed(6),
            current_value: currentValue.toFixed(2),
            pnl: '0.00',
            pnl_pct: '0.0',
          })
        }
      }
    }

    // Deduplicate: merge positions that map to the same canonical ITP ID
    // e.g., "0x000...0002" and "2" are the same ITP — keep the one with higher value
    const canonMap = new Map<string, string>() // hex key → canonical numeric key
    for (const [key] of posMap) {
      try {
        const num = BigInt(key).toString()
        if (!canonMap.has(num)) canonMap.set(num, key)
        else {
          // Merge: keep the entry with higher current_value
          const existingKey = canonMap.get(num)!
          const existing = posMap.get(existingKey)!
          const current = posMap.get(key)!
          if (parseFloat(current.current_value) > parseFloat(existing.current_value)) {
            posMap.delete(existingKey)
            canonMap.set(num, key)
          } else {
            posMap.delete(key)
          }
        }
      } catch { /* not a valid bigint, keep as-is */ }
    }

    const positions = Array.from(posMap.values())
    const totalValue = positions.reduce((sum, p) => sum + parseFloat(p.current_value), 0)
    const totalInvested = positions.reduce((sum, p) => {
      const shares = Math.max(0, parseFloat(p.shares_bought) - parseFloat(p.shares_sold))
      return sum + shares * parseFloat(p.avg_cost)
    }, 0)
    const totalPnl = totalValue - totalInvested
    const totalPnlPct = totalInvested > 0 ? ((totalValue / totalInvested) - 1) * 100 : 0

    return {
      user: summary?.user || address?.toLowerCase() || '',
      positions,
      total_value: totalValue.toFixed(2),
      total_invested: totalInvested.toFixed(2),
      total_pnl: totalPnl.toFixed(2),
      total_pnl_pct: totalPnlPct.toFixed(1),
    } as PortfolioSummary
  }, [summary, sseBalances, sseNav, address])

  // --- Orders from SSE (real-time, data-node polls L3 chain) ---
  const sseOrders = useSSEOrders()
  const ordersLoading = false
  const ordersError: string | null = null

  // Map SSE orders to ActiveOrder format
  const sseActiveOrders: ActiveOrder[] = sseOrders
    .filter(o => o.timestamp > 0)
    .map(o => ({
      orderId: o.order_id,
      user: o.user,
      itpId: o.itp_id,
      side: o.side,
      amount: BigInt(o.amount),
      limitPrice: BigInt(o.limit_price),
      status: o.status,
      timestamp: o.timestamp,
    }))

  // Merge pending Settlement orders from localStorage (not yet relayed to L3)
  const orders = useMemo(() => {
    try {
      const stored: any[] = JSON.parse(localStorage.getItem('index-pending-orders') || '[]')
      const oneHourAgo = Date.now() - 3_600_000
      // Filter: not expired, not already visible in SSE
      // Match on itpId (case-insensitive) + side + similar amount (handles hex casing differences)
      const pending = stored
        .filter(o => o.timestamp > oneHourAgo)
        .filter(o => !sseActiveOrders.some(
          s => s.itpId.toLowerCase() === (o.itpId || '').toLowerCase()
            && s.side === o.side
        ))
        .map(o => ({
          orderId: 0,
          user: address || '',
          itpId: o.itpId,
          side: o.side,
          amount: parseUnits(o.amount, 18),
          limitPrice: 0n,
          status: -1, // "Relaying" status
          timestamp: Math.floor(o.timestamp / 1000),
        }))
      // Clean up expired entries
      if (stored.some(o => o.timestamp <= oneHourAgo)) {
        localStorage.setItem('index-pending-orders', JSON.stringify(
          stored.filter(o => o.timestamp > oneHourAgo)
        ))
      }
      return [...sseActiveOrders, ...pending]
    } catch {
      return sseActiveOrders
    }
  }, [sseActiveOrders, address])

  // Refetch portfolio on buy/sell order submission from modals
  useEffect(() => {
    const handler = () => { refetch() }
    window.addEventListener('portfolio-refresh', handler)
    return () => window.removeEventListener('portfolio-refresh', handler)
  }, [refetch])

  // Build ITP name lookup: itpId → display name
  // Supports both plain number IDs ("2") and bytes32 hex ("0x000...0002")
  const itpNameMap = new Map<string, string>()
  if (deployedItps) {
    for (const itp of deployedItps) {
      const key = itp.itpId.toLowerCase()
      const name = itp.symbol ? `$${itp.symbol}` : itp.name
      itpNameMap.set(key, name)
      // Also add bytes32 hex form: pad the numeric ID to 64 hex chars
      try {
        const numericId = BigInt(itp.itpId)
        const hex32 = '0x' + numericId.toString(16).padStart(64, '0')
        itpNameMap.set(hex32, name)
      } catch {}
    }
  }

  const activeCount = orders.filter(o => o.status < 2).length
  // Only count completed fills in Trades tab — pending ones are tracked in Orders tab
  const filledTradeCount = trades.filter(tr => tr.status === 'filled').length
  const totalPnl = mergedSummary ? parseFloat(mergedSummary.total_pnl) : 0
  const positionsValue = mergedSummary ? parseFloat(mergedSummary.total_value) : 0
  // Include pending/batched order amounts in total value
  const pendingOrderValue = orders
    .filter(o => o.status < 2) // Pending or Batched
    .reduce((sum, o) => sum + parseFloat(formatUnits(o.amount, 18)), 0)
  const totalValue = positionsValue + usdcNum + pendingOrderValue
  const hasAnyBalance = totalValue > 0.01 || (mergedSummary && mergedSummary.positions.length > 0)
  const subtitle = mergedSummary
    ? t('heading.subtitle_with_data', { count: mergedSummary.positions.length, plural: mergedSummary.positions.length !== 1 ? 's' : '', value: mergedSummary.total_value })
    : t('heading.subtitle_empty')

  // Collapsed state
  if (!expanded) {
    return (
      <div
        id="portfolio"
        className="bg-card rounded-md border border-border-light p-4 hover:shadow-card-hover cursor-pointer transition-shadow"
        onClick={onToggle}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">{t('heading.collapsed_title')}</p>
            <p className="text-text-primary font-semibold">
              {t('heading.collapsed_description')}
              {activeCount > 0 && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-mono">
                  {activeCount} {tc('status.active').toLowerCase()}
                </span>
              )}
            </p>
            <p className="text-text-secondary font-mono tabular-nums text-sm mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://discord.gg/xsfgzwR6"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="px-3 py-1.5 bg-zinc-900 text-white font-semibold rounded-lg text-sm hover:bg-zinc-800 transition-colors"
            >
              {tc('nav.support')}
            </a>
            <span className="text-text-muted text-2xl select-none">+</span>
          </div>
        </div>
      </div>
    )
  }

  // Expanded state
  return (
    <div id="portfolio" className="pb-10">
      {/* Section header */}
      <div className="pt-10">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">{t('heading.label')}</p>
        <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">{t('heading.title')}</h2>
      </div>

      {!address ? (
        <div className="bg-card rounded-xl border border-border-light p-10 text-center mt-6">
          <div className="max-w-sm mx-auto">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-text-primary mb-1.5">{t('heading.subtitle_empty')}</h3>
            <p className="text-sm text-text-muted leading-relaxed">{tc('connect_wallet_to_view')}</p>
          </div>
        </div>
      ) : isLoading ? (
        <PortfolioSkeleton />
      ) : (
        <>
          {/* Stats row */}
          <div className="py-5 border-b border-border-light">
            <div className="grid grid-cols-2 md:grid-cols-5">
              <div className="py-3 pr-6">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('stats.total_value')}</div>
                <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">${totalValue.toFixed(2)}</div>
              </div>
              <div className="py-3 px-4 md:px-6 md:border-l border-border-light">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('stats.total_invested')}</div>
                <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">
                  ${((mergedSummary ? parseFloat(mergedSummary.total_invested) : 0) + pendingOrderValue).toFixed(2)}
                </div>
              </div>
              <div className="py-3 px-4 md:px-6 md:border-l border-t md:border-t-0 border-border-light">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('stats.positions')}</div>
                <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">{mergedSummary?.positions.length || 0}</div>
              </div>
              <div className="py-3 px-4 md:px-6 md:border-l border-t md:border-t-0 border-border-light">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('stats.pnl')}</div>
                <div className={`text-[22px] font-extrabold font-mono tabular-nums ${totalPnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                  {totalPnl >= 0 ? '+' : ''}${mergedSummary?.total_pnl || '0.00'}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {totalPnl >= 0 ? '+' : ''}{mergedSummary?.total_pnl_pct || '0.0'}%
                </div>
              </div>
              <div className="py-3 px-4 md:px-6 md:border-l border-t md:border-t-0 border-border-light">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('stats.usdc_available')}</div>
                <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">${usdcFormatted}</div>
              </div>
            </div>
          </div>

          {/* Active orders banner — always visible when there are incomplete orders */}
          {activeCount > 0 && (
            <div
              className="mt-5 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-yellow-100 transition-colors"
              onClick={() => setActiveTab('orders')}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                </span>
                <span className="text-sm font-medium text-yellow-800">
                  {t('orders_banner.active_orders', { count: activeCount, plural: activeCount !== 1 ? 's' : '' })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {orders.filter(o => o.status < 2).map((o, i) => (
                  <span key={`${o.orderId}-${o.timestamp}-${i}`} className={`text-xs px-2 py-0.5 rounded font-mono ${STATUS_COLORS[o.status] || 'text-orange-600 bg-orange-100'}`}>
                    {o.orderId > 0 ? `#${o.orderId}` : 'Settlement'} {o.side === 0 ? t('side.buy') : t('side.sell')} · {STATUS_LABELS[o.status] || 'Relaying'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section bar + tab navigation */}
          <div className="section-bar mt-5">
            <div>
              <div className="section-bar-title">{t('section_bar.title')}</div>
              <div className="section-bar-value">{t('section_bar.subtitle')}</div>
            </div>
          </div>
          <div className="border-b border-border-light mb-0 mt-5">
            <div className="flex gap-6">
              {(['positions', 'trades', 'orders'] as Tab[]).map(tab => {
                const label = t(`tabs.${tab}`)
                const count = tab === 'positions' ? (mergedSummary?.positions.length || 0)
                  : tab === 'trades' ? filledTradeCount
                  : activeCount
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-semibold border-b-[3px] transition-colors ${
                      activeTab === tab
                        ? 'border-black text-black'
                        : 'border-transparent text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        tab === 'orders' ? 'bg-yellow-100 text-yellow-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Explorer links */}
          {address && (L3_EXPLORER_URL || SETTLEMENT_EXPLORER_URL) && (
            <div className="flex gap-4 mt-3 mb-2 text-[11px] text-text-muted">
              {L3_EXPLORER_URL && (
                <a
                  href={`${L3_EXPLORER_URL}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-primary transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  L3 Explorer
                </a>
              )}
              {SETTLEMENT_EXPLORER_URL && (
                <a
                  href={`${SETTLEMENT_EXPLORER_URL}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-primary transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Sonic Explorer
                </a>
              )}
            </div>
          )}

          {/* Tab content */}
          {activeTab === 'positions' && (
            <>
              <ValueTab history={history} />
              <div className="mt-4" />
              <PositionsTab summary={mergedSummary} itpNameMap={itpNameMap} />
            </>
          )}
          {activeTab === 'trades' && <TradesTab trades={trades} itpNameMap={itpNameMap} />}
          {activeTab === 'orders' && (
            <OrdersTab
              orders={orders}
              isLoading={ordersLoading}
              error={ordersError}
            />
          )}
        </>
      )}
    </div>
  )
}

// --- Value Tab ---
function ValueTab({ history }: { history: PortfolioHistoryPoint[] }) {
  const t = useTranslations('portfolio')
  if (history.length === 0) {
    return null // Hide chart area entirely when no history — positions tab shows the CTA
  }

  const lastPoint = history[history.length - 1]
  const isPositive = lastPoint.pnl >= 0
  const color = isPositive ? '#16a34a' : '#dc2626'

  // Single data point — show value card instead of a broken chart
  if (history.length === 1) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8">
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">{t('chart.current_value')}</div>
          <div className="text-[36px] font-black font-mono tabular-nums text-black">${lastPoint.value.toFixed(2)}</div>
          <div className={`text-sm font-mono tabular-nums mt-2 ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
            {isPositive ? '+' : ''}{lastPoint.pnl.toFixed(2)} ({isPositive ? '+' : ''}{lastPoint.pnl_pct.toFixed(1)}%)
          </div>
          <div className="text-xs text-text-muted mt-3">{t('chart.chart_pending')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light p-4">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={history} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v)
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }}
            stroke="rgba(0,0,0,0.1)"
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'monospace' }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            stroke="rgba(0,0,0,0.1)"
            width={60}
          />
          <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" strokeDasharray="5 5" strokeWidth={1} />
          <Tooltip content={<PortfolioTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.1)' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#portfolioGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Positions Tab ---
function PositionsTab({ summary, itpNameMap }: { summary: ReturnType<typeof usePortfolio>['summary']; itpNameMap: Map<string, string> }) {
  const t = useTranslations('portfolio')
  const [page, setPage] = useState(1)
  const totalPositions = summary?.positions.length || 0
  const totalPages = Math.max(1, Math.ceil(totalPositions / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  if (!summary || summary.positions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border-light p-10 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1.5">{t('empty.no_positions_title')}</h3>
          <p className="text-sm text-text-muted leading-relaxed mb-5">
            {t('empty.no_positions_description')}
          </p>
          <a
            href="#markets"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
          >
            {t('empty.explore_indexes')}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-secondary text-[11px] font-bold uppercase tracking-wider border-b-[3px] border-black">
              <th className="text-left px-4 py-3">{t('positions_table.itp')}</th>
              <th className="text-right px-4 py-3">{t('positions_table.shares')}</th>
              <th className="text-right px-4 py-3">{t('positions_table.avg_cost')}</th>
              <th className="text-right px-4 py-3">{t('positions_table.nav')}</th>
              <th className="text-right px-4 py-3">{t('positions_table.value')}</th>
              <th className="text-right px-4 py-3">{t('positions_table.pnl')}</th>
              <th className="text-right px-4 py-3">{t('positions_table.pnl_pct')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.positions.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE).map(pos => {
              const pnl = parseFloat(pos.pnl)
              return (
                <tr key={pos.itp_id} className="border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                  <td className="px-4 py-3 text-text-primary text-sm font-semibold">
                    {itpNameMap.get(pos.itp_id.toLowerCase())
                      || (() => { try { return itpNameMap.get(BigInt(pos.itp_id).toString()) } catch { return null } })()
                      || pos.itp_id.slice(0, 10) + '...'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono text-sm tabular-nums">
                    {pos.shares_bought}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-sm tabular-nums">
                    ${pos.avg_cost}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-sm tabular-nums">
                    ${pos.current_nav}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono text-sm tabular-nums">
                    ${pos.current_value}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm tabular-nums ${pnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {pnl >= 0 ? '+' : ''}${pos.pnl}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm tabular-nums ${pnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {pnl >= 0 ? '+' : ''}{pos.pnl_pct}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={clampedPage}
        totalPages={totalPages}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
      />
    </div>
  )
}

// --- Trades Tab ---
function TradesTab({ trades, itpNameMap }: { trades: ReturnType<typeof usePortfolio>['trades']; itpNameMap: Map<string, string> }) {
  const t = useTranslations('portfolio')
  const [page, setPage] = useState(1)
  // Only show completed fills — pending orders belong in the Orders tab
  const filledTrades = trades.filter(trade => trade.status === 'filled')
  const totalPages = Math.max(1, Math.ceil(filledTrades.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  if (filledTrades.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border-light p-10 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1.5">{t('empty.no_trades_title')}</h3>
          <p className="text-sm text-text-muted leading-relaxed">
            {t('empty.no_trades_description')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-secondary text-[11px] font-bold uppercase tracking-wider border-b-[3px] border-black">
              <th className="text-left px-4 py-3">{t('trades_table.date')}</th>
              <th className="text-left px-4 py-3">{t('trades_table.itp')}</th>
              <th className="text-left px-4 py-3">{t('trades_table.side')}</th>
              <th className="text-right px-4 py-3">{t('trades_table.amount')}</th>
              <th className="text-right px-4 py-3">{t('trades_table.price')}</th>
              <th className="text-right px-4 py-3">{t('trades_table.shares')}</th>
              <th className="text-right px-4 py-3">{t('trades_table.status')}</th>
            </tr>
          </thead>
          <tbody>
            {filledTrades.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE).map(trade => (
              <tr key={trade.order_id} className="border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {getTimeAgo(new Date(trade.timestamp))}
                </td>
                <td className="px-4 py-3 text-text-primary text-sm font-semibold">
                  {itpNameMap.get(trade.itp_id.toLowerCase())
                    || (() => { try { return itpNameMap.get(BigInt(trade.itp_id).toString()) } catch { return null } })()
                    || trade.itp_id.slice(0, 10) + '...'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${trade.side === 'BUY' ? 'text-color-up' : 'text-color-down'}`}>
                    {trade.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text-primary font-mono text-sm tabular-nums">
                  ${trade.amount}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary font-mono text-sm tabular-nums">
                  {trade.fill_price ? `$${trade.fill_price}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary font-mono text-sm tabular-nums">
                  {trade.shares || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                    trade.status === 'filled'
                      ? 'text-color-up bg-green-50'
                      : 'text-yellow-700 bg-yellow-100'
                  }`}>
                    {trade.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={clampedPage}
        totalPages={totalPages}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
      />
    </div>
  )
}

// --- Orders Tab (merged from ActiveOrdersSection) ---
function OrdersTab({ orders, isLoading, error }: { orders: ActiveOrder[]; isLoading: boolean; error: string | null }) {
  const t = useTranslations('portfolio')
  const tc = useTranslations('common')
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const { writeContractAsync } = useChainWriteContract()

  const handleCancel = useCallback(async (orderId: number) => {
    setCancellingId(orderId)
    try {
      await writeContractAsync({
        address: INDEX_PROTOCOL.index,
        abi: INDEX_ABI,
        functionName: 'cancelOrder',
        args: [BigInt(orderId)],
      })
    } catch (err) {
      console.error('Cancel order failed:', err)
    } finally {
      setCancellingId(null)
    }
  }, [writeContractAsync])

  // Only show open orders: Pending (0), Batched (1), Relaying (-1)
  const openOrders = orders.filter(o => o.status < 2)
  const totalPages = Math.max(1, Math.ceil(openOrders.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
        {error}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8 text-center text-text-muted">
        {t('empty.loading_orders')}
      </div>
    )
  }

  if (openOrders.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border-light p-10 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1.5">{t('empty.no_orders_title')}</h3>
          <p className="text-sm text-text-muted leading-relaxed">
            {t('empty.no_orders_description')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-secondary text-[11px] font-bold uppercase tracking-wider border-b-[3px] border-black">
              <th className="text-left px-4 py-3">{t('orders_table.id')}</th>
              <th className="text-left px-4 py-3">{t('orders_table.side')}</th>
              <th className="text-right px-4 py-3">{t('orders_table.amount')}</th>
              <th className="text-right px-4 py-3">{t('orders_table.limit_price')}</th>
              <th className="text-right px-4 py-3">{t('orders_table.status')}</th>
              <th className="text-right px-4 py-3">{t('orders_table.time')}</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {openOrders.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE).map((order, i) => (
              <tr key={`${order.orderId}-${order.timestamp}-${i}`} className="border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                <td className="px-4 py-3 text-text-primary font-mono text-sm tabular-nums">{order.orderId > 0 ? `#${order.orderId}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${order.side === 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {order.side === 0 ? t('side.buy') : t('side.sell')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text-primary font-mono text-sm tabular-nums">
                  {parseFloat(formatUnits(order.amount, 18)).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary font-mono text-sm tabular-nums">
                  ${parseFloat(formatUnits(order.limitPrice, 18)).toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COLORS[order.status] || 'text-orange-600 bg-orange-100'}`}>
                    {STATUS_LABELS[order.status] || 'Relaying'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text-muted text-xs tabular-nums font-mono">
                  {getTimeAgo(new Date(order.timestamp * 1000))}
                </td>
                <td className="px-4 py-3 text-right">
                  {order.status === 0 && order.orderId > 0 && (
                    <button
                      onClick={() => handleCancel(order.orderId)}
                      disabled={cancellingId === order.orderId}
                      className="text-xs px-3 py-1 rounded-md font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {cancellingId === order.orderId ? t('orders_table.cancelling') : t('orders_table.cancel')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={clampedPage}
        totalPages={totalPages}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
      />
    </div>
  )
}

function Pagination({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border-light">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="text-xs font-mono font-medium px-3 py-1 rounded-md text-text-secondary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Prev
      </button>
      <span className="text-xs font-mono tabular-nums text-text-muted">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="text-xs font-mono font-medium px-3 py-1 rounded-md text-text-secondary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return seconds === 0 ? 'just now' : `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/* ── Skeleton ── */
function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

function PortfolioSkeleton() {
  const t = useTranslations('portfolio')
  const skeletonLabels = [t('stats.total_value'), t('stats.change_24h'), t('stats.positions'), t('stats.unrealized_pnl'), t('stats.usdc_available')]
  return (
    <>
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-5 py-5 border-b border-border-light">
        {skeletonLabels.map((label, idx) => (
          <div
            key={label}
            className={`py-3 px-4 md:px-6 ${idx > 0 ? 'md:border-l border-border-light' : 'md:pl-0'} ${idx >= 2 ? 'border-t md:border-t-0 border-border-light' : ''}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">{label}</p>
            <Bone w={idx === 0 ? 'w-28' : idx === 1 ? 'w-24' : 'w-16'} h="h-6" />
          </div>
        ))}
      </div>

      {/* Section bar */}
      <div className="section-bar mt-5">
        <div>
          <div className="section-bar-title">{t('section_bar.title')}</div>
          <div className="section-bar-value">{t('section_bar.subtitle')}</div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[t('skeleton.fund'), t('skeleton.ticker'), t('positions_table.shares'), t('skeleton.nav_per_share'), t('positions_table.value'), t('skeleton.avg_cost'), t('positions_table.pnl'), t('skeleton.change_24h')].map(h => (
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-text-secondary px-4 py-3 border-b-[3px] border-black whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map(row => (
              <tr key={row} className="border-b border-border-light">
                <td className="px-4 py-3"><Bone w="w-28" /><div className="mt-1"><Bone w="w-16" h="h-3" /></div></td>
                <td className="px-4 py-3"><Bone w="w-14" /></td>
                <td className="px-4 py-3"><Bone w="w-20" /></td>
                <td className="px-4 py-3"><Bone w="w-16" /></td>
                <td className="px-4 py-3"><Bone w="w-20" /></td>
                <td className="px-4 py-3"><Bone w="w-16" /></td>
                <td className="px-4 py-3"><Bone w="w-16" /></td>
                <td className="px-4 py-3"><Bone w="w-12" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
