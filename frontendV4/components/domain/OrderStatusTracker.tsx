'use client'

import { useEffect, useRef } from 'react'
import { useOrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from '@/hooks/useOrderStatus'
import { useFillDetails } from '@/hooks/useFillDetails'
import { formatUnits } from 'viem'

interface OrderStatusTrackerProps {
  orderId: bigint
  onComplete?: () => void
}

const STATUS_STEPS = [
  { status: OrderStatus.PENDING, label: 'Pending' },
  { status: OrderStatus.BATCHED, label: 'Batched' },
  { status: OrderStatus.FILLED, label: 'Filled' },
]

export function OrderStatusTracker({ orderId, onComplete }: OrderStatusTrackerProps) {
  const { order, statusLabel, statusColor, isLoading, error } = useOrderStatus(orderId)
  const { fill } = useFillDetails(orderId)

  const currentStatus = order?.status ?? OrderStatus.PENDING
  const hasCalledComplete = useRef(false)

  // Notify parent when filled (once only)
  useEffect(() => {
    if (currentStatus === OrderStatus.FILLED && onComplete && !hasCalledComplete.current) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [currentStatus, onComplete])

  if (error) {
    return (
      <div className="bg-surface-down border border-color-down/30 rounded-xl p-4 text-color-down text-sm">
        Failed to track order: {error}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border-light rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-text-primary">Order #{orderId.toString()}</h4>
        <span className={`text-xs px-2 py-1 rounded bg-muted ${statusColor}`}>
          {isLoading ? 'Loading...' : statusLabel}
        </span>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1 mb-4">
        {STATUS_STEPS.map((step, i) => {
          const isActive = currentStatus >= step.status
          const isCurrent = currentStatus === step.status
          return (
            <div key={step.status} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : 'bg-muted text-text-muted'
                  } ${isCurrent ? 'ring-2 ring-zinc-400' : ''}`}
                >
                  {isActive ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                  {step.label}
                </span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${
                  currentStatus > step.status ? 'bg-zinc-900' : 'bg-border-light'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Cancelled / Expired states */}
      {currentStatus === OrderStatus.CANCELLED && (
        <div className="text-color-down text-sm p-2 bg-surface-down rounded-lg">
          Order was cancelled
        </div>
      )}
      {currentStatus === OrderStatus.EXPIRED && (
        <div className="text-text-muted text-sm p-2 bg-muted rounded-lg">
          Order expired (deadline passed)
        </div>
      )}

      {/* Order details */}
      {order && (
        <div className="text-xs text-text-muted font-mono space-y-1 mt-3 pt-3 border-t border-border-light">
          <p>Side: {order.side === 0 ? 'BUY' : 'SELL'}</p>
          <p>Amount: {formatUnits(order.amount, 18)}</p>
          <p>Limit Price: {formatUnits(order.limitPrice, 18)}</p>
        </div>
      )}

      {/* Fill details (shown when order is filled) */}
      {fill && order && (
        <div className="text-xs font-mono space-y-1 mt-3 pt-3 border-t border-border-light">
          <p className="text-text-primary font-medium mb-1">Fill Details</p>
          <p className="text-text-muted">
            Fill Price: <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(fill.fillPrice, 18)).toFixed(4)}</span>
          </p>
          <p className="text-text-muted">
            Fill Amount: <span className="text-text-primary tabular-nums">{parseFloat(formatUnits(fill.fillAmount, 18)).toFixed(4)}</span>
          </p>
          {order.limitPrice > 0n && (() => {
            const slippage = Number(fill.fillPrice - order.limitPrice) * 100 / Number(order.limitPrice)
            const slippageColor = Math.abs(slippage) < 1 ? 'text-color-up' : Math.abs(slippage) < 3 ? 'text-color-warning' : 'text-color-down'
            return (
              <p className="text-text-muted">
                Slippage: <span className={slippageColor}>{slippage > 0 ? '+' : ''}{slippage.toFixed(2)}%</span>
              </p>
            )
          })()}
          {order.side === 0 && fill.fillPrice > 0n && (
            <p className="text-text-muted">
              Cost/Share: <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(fill.fillPrice, 18)).toFixed(4)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
