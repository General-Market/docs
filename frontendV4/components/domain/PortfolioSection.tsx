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
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'

type Tab = 'value' | 'positions' | 'trades' | 'orders'

interface PortfolioSectionProps {
  expanded: boolean
  onToggle: () => void
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

export function PortfolioSection({ expanded, onToggle }: PortfolioSectionProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { summary, history, trades, isLoading, error } = usePortfolio(address?.toLowerCase())
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

  useEffect(() => {
    if (!expanded || activeTab !== 'orders') return
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [expanded, activeTab, fetchOrders])

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
        className="bg-card rounded-xl shadow-card border border-border-light p-4 hover:shadow-card-hover cursor-pointer transition-shadow"
        onClick={onToggle}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">Portfolio</p>
            <p className="text-text-primary font-semibold">Your positions &amp; performance</p>
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
    <div id="portfolio">
      {/* Section header — sits on dark page bg, uses inverse text */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-2">Portfolio</p>
          <h2 className="text-2xl font-semibold text-text-inverse">Your positions &amp; performance</h2>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <a
            href="https://discord.gg/xsfgzwR6"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-zinc-900 text-white font-semibold rounded-lg text-sm hover:bg-zinc-800 transition-colors"
          >
            Support
          </a>
          <button
            onClick={onToggle}
            className="text-text-inverse-muted hover:text-text-inverse text-2xl leading-none transition-colors select-none"
            aria-label="Collapse portfolio"
          >
            −
          </button>
        </div>
      </div>

      {!address ? (
        <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
          Connect wallet to view portfolio
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
          {error}
        </div>
      ) : isLoading ? (
        <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
          Loading portfolio...
        </div>
      ) : (
        <>
          {/* Summary stat cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-card rounded-xl shadow-card border border-border-light p-6 text-center">
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Total Value</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">${summary.total_value}</p>
              </div>
              <div className="bg-card rounded-xl shadow-card border border-border-light p-6 text-center">
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Total Invested</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">${summary.total_invested}</p>
              </div>
              <div className="bg-card rounded-xl shadow-card border border-border-light p-6 text-center">
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">P&amp;L</p>
                <p className={`text-2xl font-bold tabular-nums font-mono ${totalPnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                  {totalPnl >= 0 ? '+' : ''}${summary.total_pnl}{' '}
                  <span className="text-base font-medium">
                    ({totalPnl >= 0 ? '+' : ''}{summary.total_pnl_pct}%)
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Underline tab navigation */}
          <div className="border-b border-border-light mb-6">
            <div className="flex gap-6">
              {(['value', 'positions', 'trades', 'orders'] as Tab[]).map(tab => {
                const label = tab.charAt(0).toUpperCase() + tab.slice(1)
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-zinc-900 text-text-primary'
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
          {activeTab === 'positions' && <PositionsTab summary={summary} />}
          {activeTab === 'trades' && <TradesTab trades={trades} />}
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
      <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
        No portfolio history yet
      </div>
    )
  }

  const lastPoint = history[history.length - 1]
  const isPositive = lastPoint.pnl >= 0
  const color = isPositive ? '#16a34a' : '#dc2626'

  return (
    <div className="bg-card rounded-xl shadow-card border border-border-light p-4">
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
function PositionsTab({ summary }: { summary: ReturnType<typeof usePortfolio>['summary'] }) {
  if (!summary || summary.positions.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
        No open positions
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-card border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-muted text-xs font-sans border-b border-border-light bg-muted">
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
                <tr key={pos.itp_id} className="border-b border-border-light last:border-0 hover:bg-card-hover transition-colors">
                  <td className="px-4 py-3 text-text-primary font-mono text-sm tabular-nums">
                    {pos.itp_id.slice(0, 10)}...
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
function TradesTab({ trades }: { trades: ReturnType<typeof usePortfolio>['trades'] }) {
  if (trades.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
        No trades yet
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-card border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-muted text-xs font-sans border-b border-border-light bg-muted">
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
              <tr key={trade.order_id} className="border-b border-border-light last:border-0 hover:bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {getTimeAgo(new Date(trade.timestamp))}
                </td>
                <td className="px-4 py-3 text-text-primary font-mono text-sm tabular-nums">
                  {trade.itp_id.slice(0, 10)}...
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
      <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
        Loading orders...
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center text-text-muted">
        No orders found
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-card border border-border-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-muted text-xs font-sans border-b border-border-light bg-muted">
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
              <tr key={order.orderId} className="border-b border-border-light last:border-0 hover:bg-card-hover transition-colors">
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
