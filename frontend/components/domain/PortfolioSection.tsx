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
  0: 'text-yellow-400 bg-yellow-500/20',
  1: 'text-blue-400 bg-blue-500/20',
  2: 'text-green-400 bg-green-500/20',
  3: 'text-red-400 bg-red-500/20',
  4: 'text-white/50 bg-white/10',
}

function PortfolioTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as PortfolioHistoryPoint

  return (
    <div className="bg-terminal border border-white/20 p-3 font-mono text-sm shadow-lg">
      <p className="text-white font-bold mb-1">{data.date}</p>
      <div className="space-y-1 text-white/80">
        <p>Value: ${data.value.toFixed(2)}</p>
        <p className={data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
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

  return (
    <div id="portfolio" className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">Portfolio</h2>
          <p className="text-sm text-white/50">{subtitle}</p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-white/10">
          {!address ? (
            <div className="text-center py-8 text-white/50">Connect wallet to view portfolio</div>
          ) : error ? (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-white/50">Loading portfolio...</div>
          ) : (
            <>
              {/* Summary bar */}
              {summary && (
                <div className="grid grid-cols-3 gap-4 mb-4 pt-4">
                  <div className="text-center">
                    <p className="text-white/50 text-xs">Total Value</p>
                    <p className="text-white font-mono text-lg">${summary.total_value}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50 text-xs">Total Invested</p>
                    <p className="text-white font-mono text-lg">${summary.total_invested}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50 text-xs">Total PnL</p>
                    <p className={`font-mono text-lg ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalPnl >= 0 ? '+' : ''}${summary.total_pnl} ({totalPnl >= 0 ? '+' : ''}{summary.total_pnl_pct}%)
                    </p>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {(['value', 'positions', 'trades', 'orders'] as Tab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm rounded ${
                      activeTab === tab
                        ? 'bg-accent/20 text-accent border border-accent/50'
                        : 'text-white/50 hover:text-white/80 border border-white/10'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'orders' && activeCount > 0 && (
                      <span className="ml-1.5 text-xs bg-yellow-500/30 text-yellow-400 px-1.5 py-0.5 rounded-full">
                        {activeCount}
                      </span>
                    )}
                  </button>
                ))}
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
      )}
    </div>
  )
}

// --- Value Tab ---
function ValueTab({ history }: { history: PortfolioHistoryPoint[] }) {
  if (history.length === 0) {
    return <div className="text-center py-8 text-white/50">No portfolio history yet</div>
  }

  const lastPoint = history[history.length - 1]
  const isPositive = lastPoint.pnl >= 0
  const color = isPositive ? '#4ade80' : '#C40000'

  return (
    <div className="bg-terminal border border-white/20">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={history} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'white', fontSize: 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v)
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis
            tick={{ fill: 'white', fontSize: 11, fontFamily: 'monospace' }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            stroke="rgba(255,255,255,0.3)"
            width={60}
          />
          <ReferenceLine y={0} stroke="#C40000" strokeDasharray="5 5" strokeWidth={1} />
          <Tooltip content={<PortfolioTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
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
    return <div className="text-center py-8 text-white/50">No open positions</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-white/60 text-xs font-mono border-b border-white/10">
            <th className="text-left pb-3">ITP</th>
            <th className="text-right pb-3">Shares</th>
            <th className="text-right pb-3">Avg Cost</th>
            <th className="text-right pb-3">NAV</th>
            <th className="text-right pb-3">Value</th>
            <th className="text-right pb-3">PnL</th>
            <th className="text-right pb-3">PnL%</th>
          </tr>
        </thead>
        <tbody>
          {summary.positions.map(pos => {
            const pnl = parseFloat(pos.pnl)
            return (
              <tr key={pos.itp_id} className="border-b border-white/5 last:border-0">
                <td className="py-3 text-white font-mono text-sm">
                  {pos.itp_id.slice(0, 10)}...
                </td>
                <td className="py-3 text-right text-white font-mono text-sm">
                  {pos.shares_bought}
                </td>
                <td className="py-3 text-right text-white/70 font-mono text-sm">
                  ${pos.avg_cost}
                </td>
                <td className="py-3 text-right text-white/70 font-mono text-sm">
                  ${pos.current_nav}
                </td>
                <td className="py-3 text-right text-white font-mono text-sm">
                  ${pos.current_value}
                </td>
                <td className={`py-3 text-right font-mono text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}${pos.pnl}
                </td>
                <td className={`py-3 text-right font-mono text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{pos.pnl_pct}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Trades Tab ---
function TradesTab({ trades }: { trades: ReturnType<typeof usePortfolio>['trades'] }) {
  if (trades.length === 0) {
    return <div className="text-center py-8 text-white/50">No trades yet</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-white/60 text-xs font-mono border-b border-white/10">
            <th className="text-left pb-3">Date</th>
            <th className="text-left pb-3">ITP</th>
            <th className="text-left pb-3">Side</th>
            <th className="text-right pb-3">Amount</th>
            <th className="text-right pb-3">Price</th>
            <th className="text-right pb-3">Shares</th>
            <th className="text-right pb-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(trade => (
            <tr key={trade.order_id} className="border-b border-white/5 last:border-0">
              <td className="py-3 text-white/70 text-xs">
                {getTimeAgo(new Date(trade.timestamp))}
              </td>
              <td className="py-3 text-white font-mono text-sm">
                {trade.itp_id.slice(0, 10)}...
              </td>
              <td className="py-3">
                <span className={`text-sm font-bold ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.side}
                </span>
              </td>
              <td className="py-3 text-right text-white font-mono text-sm">
                ${trade.amount}
              </td>
              <td className="py-3 text-right text-white/70 font-mono text-sm">
                {trade.fill_price ? `$${trade.fill_price}` : '—'}
              </td>
              <td className="py-3 text-right text-white/70 font-mono text-sm">
                {trade.shares || '—'}
              </td>
              <td className="py-3 text-right">
                <span className={`text-xs px-2 py-1 rounded ${
                  trade.status === 'filled'
                    ? 'text-green-400 bg-green-500/20'
                    : 'text-yellow-400 bg-yellow-500/20'
                }`}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Orders Tab (merged from ActiveOrdersSection) ---
function OrdersTab({ orders, isLoading, error }: { orders: ActiveOrder[]; isLoading: boolean; error: string | null }) {
  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (isLoading) {
    return <div className="text-center py-8 text-white/50">Loading orders...</div>
  }

  if (orders.length === 0) {
    return <div className="text-center py-8 text-white/50">No orders found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-white/60 text-xs font-mono border-b border-white/10">
            <th className="text-left pb-3">ID</th>
            <th className="text-left pb-3">Side</th>
            <th className="text-right pb-3">Amount</th>
            <th className="text-right pb-3">Limit Price</th>
            <th className="text-right pb-3">Status</th>
            <th className="text-right pb-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="border-b border-white/5 last:border-0">
              <td className="py-3 text-white font-mono text-sm">#{order.orderId}</td>
              <td className="py-3">
                <span className={`text-sm font-bold ${order.side === 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {order.side === 0 ? 'BUY' : 'SELL'}
                </span>
              </td>
              <td className="py-3 text-right text-white font-mono text-sm">
                {parseFloat(formatUnits(order.amount, 18)).toFixed(2)}
              </td>
              <td className="py-3 text-right text-white/70 font-mono text-sm">
                ${parseFloat(formatUnits(order.limitPrice, 18)).toFixed(4)}
              </td>
              <td className="py-3 text-right">
                <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[order.status] || 'text-white/50 bg-white/10'}`}>
                  {STATUS_LABELS[order.status] || 'Unknown'}
                </span>
              </td>
              <td className="py-3 text-right text-white/50 text-xs">
                {getTimeAgo(new Date(order.timestamp * 1000))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
