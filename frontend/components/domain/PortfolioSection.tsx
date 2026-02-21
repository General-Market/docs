'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
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
import { formatUnits } from 'viem'
import { usePortfolio, PortfolioHistoryPoint } from '@/hooks/usePortfolio'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { DeployedItpRef } from '@/components/domain/ItpListing'

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
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as PortfolioHistoryPoint

  return (
    <div className="bg-card border border-border-light rounded-lg shadow-card p-3 text-sm">
      <p className="text-text-primary font-semibold mb-1">{data.date}</p>
      <div className="space-y-1 text-text-secondary">
        <p className="font-mono tabular-nums">Value: ${data.value.toFixed(2)}</p>
        <p className={`font-mono tabular-nums ${data.pnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
          PnL: {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)} ({data.pnl_pct >= 0 ? '+' : ''}{data.pnl_pct.toFixed(1)}%)
        </p>
      </div>
    </div>
  )
}

export function PortfolioSection({ expanded, onToggle, deployedItps }: PortfolioSectionProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { summary, history, trades, isLoading, error } = usePortfolio(address?.toLowerCase())
  const { formatted: usdcFormatted } = useUsdcBalance()
  const [activeTab, setActiveTab] = useState<Tab>('value')

  // --- Orders state ---
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const publicClientRef = useRef(publicClient)

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  const fetchOrders = useCallback(async () => {
    const client = publicClientRef.current
    if (!client) return

    try {
      const nextId = await client.readContract({
        address: INDEX_PROTOCOL.index,
        abi: INDEX_ABI,
        functionName: 'nextOrderId',
      }) as bigint

      const count = Number(nextId)
      if (count === 0) {
        setOrders([])
        setOrdersLoading(false)
        return
      }

      const startId = Math.max(0, count - 50)
      const fetched: ActiveOrder[] = []

      for (let i = startId; i < count; i++) {
        try {
          const result = await client.readContract({
            address: INDEX_PROTOCOL.index,
            abi: INDEX_ABI,
            functionName: 'getOrder',
            args: [BigInt(i)],
          }) as any

          fetched.push({
            orderId: Number(result.id),
            user: result.user,
            itpId: result.itpId,
            side: Number(result.side),
            amount: result.amount,
            limitPrice: result.limitPrice,
            status: Number(result.status),
            timestamp: Number(result.timestamp),
          })
        } catch {
          // Skip failed reads
        }
      }

      const userOrders = address
        ? fetched.filter(o => o.user.toLowerCase() === address.toLowerCase() && o.timestamp > 0)
        : fetched.filter(o => o.timestamp > 0)

      const active = userOrders.filter(o => o.status < 2)
      const filled = userOrders.filter(o => o.status >= 2).slice(-5)
      setOrders([...active, ...filled])
      setOrdersError(null)
    } catch (e: any) {
      setOrdersError(e.message || 'Failed to fetch orders')
    } finally {
      setOrdersLoading(false)
    }
  }, [address])

  // Always fetch orders when wallet is connected (for active badge on collapsed card too)
  useEffect(() => {
    if (!address) return
    fetchOrders()
    const interval = setInterval(fetchOrders, expanded ? 5000 : 15000)
    return () => clearInterval(interval)
  }, [expanded, fetchOrders, address])

  // Build ITP name lookup: itpId → display name
  const itpNameMap = new Map<string, string>()
  if (deployedItps) {
    for (const itp of deployedItps) {
      const key = itp.itpId.toLowerCase()
      itpNameMap.set(key, itp.symbol ? `$${itp.symbol}` : itp.name)
    }
  }

  const activeCount = orders.filter(o => o.status < 2).length
  const totalPnl = summary ? parseFloat(summary.total_pnl) : 0
  const subtitle = summary
    ? `${summary.positions.length} position${summary.positions.length !== 1 ? 's' : ''} · $${summary.total_value} value`
    : 'Track your positions, trades & orders'

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
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">Portfolio</p>
            <p className="text-text-primary font-semibold">
              Your positions &amp; performance
              {activeCount > 0 && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-mono">
                  {activeCount} active
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
              Support
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
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Your Holdings</p>
        <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Portfolio</h2>
      </div>

      {!address || isLoading ? (
        <PortfolioSkeleton />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
          {error}
        </div>
      ) : (
        <>
          {/* Stats row — mockup: .stats-row padding: 20px 0; .stat-cell padding: 12px 24px */}
          {summary && (
            <div className="py-5 border-b border-border-light">
              <div className="grid grid-cols-2 md:grid-cols-5">
                <div className="py-3 pr-6">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Total Value</div>
                  <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">${summary.total_value}</div>
                </div>
                <div className="py-3 px-4 md:px-6 md:border-l border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Total Invested</div>
                  <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">${summary.total_invested}</div>
                </div>
                <div className="py-3 px-4 md:px-6 md:border-l border-t md:border-t-0 border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Positions</div>
                  <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">{summary.positions.length}</div>
                </div>
                <div className="py-3 px-4 md:px-6 md:border-l border-t md:border-t-0 border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">P&amp;L</div>
                  <div className={`text-[22px] font-extrabold font-mono tabular-nums ${totalPnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {totalPnl >= 0 ? '+' : ''}${summary.total_pnl}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {totalPnl >= 0 ? '+' : ''}{summary.total_pnl_pct}%
                  </div>
                </div>
                <div className="py-3 px-4 md:px-6 md:border-l border-t md:border-t-0 border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">USDC Available</div>
                  <div className="text-[22px] font-extrabold font-mono tabular-nums text-black">${usdcFormatted}</div>
                </div>
              </div>
            </div>
          )}

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
                  {activeCount} active order{activeCount !== 1 ? 's' : ''} in progress
                </span>
              </div>
              <div className="flex items-center gap-2">
                {orders.filter(o => o.status < 2).map(o => (
                  <span key={o.orderId} className={`text-xs px-2 py-0.5 rounded font-mono ${STATUS_COLORS[o.status]}`}>
                    #{o.orderId} {o.side === 0 ? 'BUY' : 'SELL'} · {STATUS_LABELS[o.status]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section bar + tab navigation */}
          <div className="section-bar mt-5">
            <div>
              <div className="section-bar-title">Positions</div>
              <div className="section-bar-value">Active Holdings</div>
            </div>
          </div>
          <div className="border-b border-border-light mb-0 mt-5">
            <div className="flex gap-6">
              {(['value', 'positions', 'trades', 'orders'] as Tab[]).map(tab => {
                const label = tab.charAt(0).toUpperCase() + tab.slice(1)
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
                    {tab === 'orders' && activeCount > 0 && (
                      <span className="ml-1.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                        {activeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'value' && <ValueTab history={history} />}
          {activeTab === 'positions' && <PositionsTab summary={summary} itpNameMap={itpNameMap} />}
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
  if (history.length === 0) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8 text-center text-text-muted">
        No portfolio history yet
      </div>
    )
  }

  const lastPoint = history[history.length - 1]
  const isPositive = lastPoint.pnl >= 0
  const color = isPositive ? '#16a34a' : '#dc2626'

  // Single data point — show value card instead of a broken chart
  if (history.length === 1) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8">
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Current Value</div>
          <div className="text-[36px] font-black font-mono tabular-nums text-black">${lastPoint.value.toFixed(2)}</div>
          <div className={`text-sm font-mono tabular-nums mt-2 ${isPositive ? 'text-color-up' : 'text-color-down'}`}>
            {isPositive ? '+' : ''}{lastPoint.pnl.toFixed(2)} ({isPositive ? '+' : ''}{lastPoint.pnl_pct.toFixed(1)}%)
          </div>
          <div className="text-xs text-text-muted mt-3">Chart will populate as more data becomes available</div>
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
  if (!summary || summary.positions.length === 0) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8 text-center text-text-muted">
        No open positions
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-secondary text-[11px] font-bold uppercase tracking-wider border-b-[3px] border-black">
              <th className="text-left px-4 py-3">ITP</th>
              <th className="text-right px-4 py-3">Shares</th>
              <th className="text-right px-4 py-3">Avg Cost</th>
              <th className="text-right px-4 py-3">NAV</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-right px-4 py-3">PnL</th>
              <th className="text-right px-4 py-3">PnL%</th>
            </tr>
          </thead>
          <tbody>
            {summary.positions.map(pos => {
              const pnl = parseFloat(pos.pnl)
              return (
                <tr key={pos.itp_id} className="border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                  <td className="px-4 py-3 text-text-primary text-sm font-semibold">
                    {itpNameMap.get(pos.itp_id.toLowerCase()) || pos.itp_id.slice(0, 10) + '...'}
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
    </div>
  )
}

// --- Trades Tab ---
function TradesTab({ trades, itpNameMap }: { trades: ReturnType<typeof usePortfolio>['trades']; itpNameMap: Map<string, string> }) {
  if (trades.length === 0) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8 text-center text-text-muted">
        No trades yet
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-secondary text-[11px] font-bold uppercase tracking-wider border-b-[3px] border-black">
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">ITP</th>
              <th className="text-left px-4 py-3">Side</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Shares</th>
              <th className="text-right px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade.order_id} className="border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {getTimeAgo(new Date(trade.timestamp))}
                </td>
                <td className="px-4 py-3 text-text-primary text-sm font-semibold">
                  {itpNameMap.get(trade.itp_id.toLowerCase()) || trade.itp_id.slice(0, 10) + '...'}
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
    </div>
  )
}

// --- Orders Tab (merged from ActiveOrdersSection) ---
function OrdersTab({ orders, isLoading, error }: { orders: ActiveOrder[]; isLoading: boolean; error: string | null }) {
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
        Loading orders...
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-card rounded-md border border-border-light p-8 text-center text-text-muted">
        No orders found
      </div>
    )
  }

  return (
    <div className="bg-card rounded-md border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-secondary text-[11px] font-bold uppercase tracking-wider border-b-[3px] border-black">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Side</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3">Limit Price</th>
              <th className="text-right px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderId} className="border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                <td className="px-4 py-3 text-text-primary font-mono text-sm tabular-nums">#{order.orderId}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${order.side === 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {order.side === 0 ? 'BUY' : 'SELL'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text-primary font-mono text-sm tabular-nums">
                  {parseFloat(formatUnits(order.amount, 18)).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary font-mono text-sm tabular-nums">
                  ${parseFloat(formatUnits(order.limitPrice, 18)).toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COLORS[order.status] || 'text-text-muted bg-muted'}`}>
                    {STATUS_LABELS[order.status] || 'Unknown'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text-muted text-xs tabular-nums font-mono">
                  {getTimeAgo(new Date(order.timestamp * 1000))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
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
  return (
    <>
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-5 py-5 border-b border-border-light">
        {['Total Value', '24h Change', 'Positions', 'Unrealized P&L', 'USDC Available'].map((label, idx) => (
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
          <div className="section-bar-title">Positions</div>
          <div className="section-bar-value">Active Holdings</div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['Fund', 'Ticker', 'Shares', 'NAV / Share', 'Value', 'Avg Cost', 'P&L', '24h'].map(h => (
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
