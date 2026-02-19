'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { formatUnits } from 'viem'

interface ActiveOrder {
  orderId: number
  user: string
  itpId: string
  side: number // 0=BUY, 1=SELL
  amount: bigint
  limitPrice: bigint
  status: number // 0=PENDING, 1=BATCHED, 2=FILLED
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

interface ActiveOrdersSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function ActiveOrdersSection({ expanded, onToggle }: ActiveOrdersSectionProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const publicClientRef = useRef(publicClient)

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  const fetchOrders = useCallback(async () => {
    const client = publicClientRef.current
    if (!client) return

    try {
      // Get next order ID to know how many orders exist
      const nextId = await client.readContract({
        address: INDEX_PROTOCOL.index,
        abi: INDEX_ABI,
        functionName: 'nextOrderId',
      }) as bigint

      const count = Number(nextId)
      if (count === 0) {
        setOrders([])
        setIsLoading(false)
        return
      }

      // Fetch all orders (last 50 max)
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

      // Filter to connected user's orders only
      const userOrders = address
        ? fetched.filter(o => o.user.toLowerCase() === address.toLowerCase() && o.timestamp > 0)
        : fetched.filter(o => o.timestamp > 0)

      // Show active orders first (pending/batched), then recent filled
      const active = userOrders.filter(o => o.status < 2)
      const filled = userOrders.filter(o => o.status >= 2).slice(-5)
      setOrders([...active, ...filled])
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch orders')
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (!expanded) return
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [expanded, fetchOrders])

  const activeCount = orders.filter(o => o.status < 2).length

  return (
    <div id="active-orders" className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">Active Orders</h2>
          <p className="text-sm text-white/50">
            {activeCount > 0 ? `${activeCount} active order${activeCount > 1 ? 's' : ''}` : 'Monitor pending and batched orders'}
          </p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-white/10">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-white/50">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-white/50">No orders found</div>
          ) : (
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
          )}
        </div>
      )}
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
