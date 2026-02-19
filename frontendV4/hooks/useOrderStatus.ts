'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchOrder } from '@/lib/api/backend'

export enum OrderStatus {
  PENDING = 0,
  BATCHED = 1,
  FILLED = 2,
  CANCELLED = 3,
  EXPIRED = 4,
}

export const ORDER_STATUS_LABELS: Record<number, string> = {
  [OrderStatus.PENDING]: 'Pending',
  [OrderStatus.BATCHED]: 'Batched',
  [OrderStatus.FILLED]: 'Filled',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.EXPIRED]: 'Expired',
}

export const ORDER_STATUS_COLORS: Record<number, string> = {
  [OrderStatus.PENDING]: 'text-yellow-400',
  [OrderStatus.BATCHED]: 'text-blue-400',
  [OrderStatus.FILLED]: 'text-green-400',
  [OrderStatus.CANCELLED]: 'text-red-400',
  [OrderStatus.EXPIRED]: 'text-white/50',
}

interface OrderData {
  id: bigint
  user: string
  side: number
  amount: bigint
  limitPrice: bigint
  itpId: string
  timestamp: bigint
  status: number
}

interface FillDetails {
  fillPrice: bigint
  fillAmount: bigint
  cycleNumber: bigint
}

interface UseOrderStatusReturn {
  order: OrderData | null
  fill: FillDetails | null
  statusLabel: string
  statusColor: string
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Fetches order status + fill details from the backend /order endpoint.
 * Polls every 5s. Combines former useOrderStatus + useFillDetails.
 */
export function useOrderStatus(orderId: bigint | null): UseOrderStatusReturn {
  const [order, setOrder] = useState<OrderData | null>(null)
  const [fill, setFill] = useState<FillDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (orderId === null) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchOrder(orderId)
      if (result) {
        setOrder({
          id: BigInt(result.id),
          user: result.user,
          side: result.side,
          amount: BigInt(result.amount),
          limitPrice: BigInt(result.limit_price),
          itpId: result.itp_id,
          timestamp: BigInt(result.timestamp),
          status: result.status,
        })

        if (result.fill) {
          setFill({
            fillPrice: BigInt(result.fill.fill_price),
            fillAmount: BigInt(result.fill.fill_amount),
            cycleNumber: BigInt(result.fill.cycle_number),
          })
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch order')
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (orderId === null) return
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [orderId, refresh])

  const status = order?.status ?? OrderStatus.PENDING
  return {
    order,
    fill,
    statusLabel: ORDER_STATUS_LABELS[status] || 'Unknown',
    statusColor: ORDER_STATUS_COLORS[status] || 'text-white/50',
    isLoading,
    error,
    refresh,
  }
}
