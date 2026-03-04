'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatUnits } from 'viem'
import { useVaultTrades, type VaultTrade } from '@/hooks/useVaultTrades'
import { useSystemStatus, type RecentOrder } from '@/hooks/useSystemStatus'
import type { DeployedItpRef } from '@/components/domain/ItpListing'

const PAGE_SIZE = 15

// ── Helpers ──

function formatRelativeTime(unixSeconds: number): string {
  if (!unixSeconds) return '\u2014'
  const diffMs = Date.now() - unixSeconds * 1000
  if (diffMs < 0) return 'just now'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatAmount18(amount: bigint, decimals: number = 2): string {
  const num = Number(formatUnits(amount, 18))
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals > 2 ? decimals : 4,
  })
}

function formatPrice(price: number): string {
  if (price === 0) return '\u2014'
  if (price >= 10_000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (price >= 100) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
  if (price >= 0.01) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
  return `$${price.toExponential(2)}`
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || '\u2014'
  return addr.slice(0, 6) + '\u2026' + addr.slice(-4)
}

/**
 * Build a map from vault trade -> ITP id(s) by correlating SSE recent orders
 * with vault trades via timestamp proximity and USDC amount matching.
 */
function buildTradeItpMap(
  trades: VaultTrade[],
  orders: RecentOrder[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (orders.length === 0) return map

  for (const trade of trades) {
    const itpIds: string[] = []

    for (const order of orders) {
      if (order.status !== 'filled') continue

      // Match by timestamp: trade timestamp should be within 30s of order block timestamp
      const timeDiff = Math.abs(trade.timestamp - order.blockTimestamp)
      if (timeDiff > 30) continue

      // Match by USDC amount: the order amount should roughly match the USDC side of the trade
      const orderAmount = order.amount
      const tradeUsdc = trade.usdcAmount
      if (orderAmount === 0n || tradeUsdc === 0n) continue

      // Allow 5% tolerance for fee differences
      const ratio = Number(tradeUsdc) / Number(orderAmount)
      if (ratio > 0.5 && ratio < 2.0) {
        if (!itpIds.includes(order.itpId)) {
          itpIds.push(order.itpId)
        }
      }
    }

    if (itpIds.length > 0) {
      map.set(trade.tradeId.toString(), itpIds)
    }
  }

  return map
}

// ── Skeletons ──

function Bone({ w = 'w-16', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

function TableRowsSkeleton() {
  const widths = ['w-14', 'w-12', 'w-10', 'w-16', 'w-16', 'w-14', 'w-16', 'w-10']
  return (
    <>
      {Array.from({ length: 6 }, (_, r) => (
        <tr key={r} className="border-b border-border-light">
          {widths.map((w, c) => (
            <td key={c} className="px-4 py-3">
              <Bone w={w} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Component ──

interface VaultTradesFeedProps {
  deployedItps?: DeployedItpRef[]
}

export function VaultTradesFeed({ deployedItps }: VaultTradesFeedProps) {
  const { trades, totalCount, feeBps, isLoading, error } = useVaultTrades()
  const sys = useSystemStatus()
  const [page, setPage] = useState(0)

  // Tick relative times every 15s
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 15_000)
    return () => clearInterval(timer)
  }, [])

  // ITP name lookup
  const itpNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (deployedItps) {
      for (const itp of deployedItps) {
        map.set(itp.itpId.toLowerCase(), itp.symbol ? `$${itp.symbol}` : itp.name)
      }
    }
    return map
  }, [deployedItps])

  // ITP attribution map
  const tradeItpMap = useMemo(
    () => buildTradeItpMap(trades, sys.recentOrders),
    [trades, sys.recentOrders],
  )

  // Pagination
  const totalPages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE))
  const pageItems = useMemo(() => {
    const start = page * PAGE_SIZE
    return trades.slice(start, start + PAGE_SIZE)
  }, [trades, page])

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(0)
  }, [page, totalPages])

  const feeLabel = feeBps > 0 ? `${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 1)}%` : '\u2014'

  return (
    <div>
      {/* Section header */}
      <div className="section-bar">
        <div>
          <div className="section-bar-title">AP Order Feed</div>
          <div className="section-bar-value">
            {totalCount > 0
              ? `${totalCount.toLocaleString()} trades executed \u00b7 fee: ${feeLabel}`
              : 'MockBitgetVault trade history'}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 text-[12px] text-color-down bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[780px]">
          <thead>
            <tr>
              {['Time', 'Token', 'Side', 'Amount', 'Price', 'Fee', 'ITP(s)', 'Trade ID'].map((h, i) => (
                <th
                  key={h}
                  className={`text-left text-[11px] font-bold uppercase tracking-[0.06em] text-text-secondary px-4 py-3 border-b-[3px] border-black whitespace-nowrap ${
                    i === 3 || i === 4 || i === 5 ? 'text-right' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              isLoading ? <TableRowsSkeleton /> : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[13px] text-text-muted">
                    No trades recorded yet
                  </td>
                </tr>
              )
            )}
            {pageItems.map((trade) => {
              const itpIds = tradeItpMap.get(trade.tradeId.toString())
              const itpLabels = itpIds
                ? itpIds.map(id => itpNameMap.get(id.toLowerCase()) || truncateAddr(id)).join(', ')
                : '\u2014'

              return (
                <tr key={trade.tradeId.toString()} className="hover:bg-surface">
                  {/* Time */}
                  <td className="px-4 py-3 border-b border-border-light font-mono text-text-secondary tabular-nums text-[12px]">
                    {formatRelativeTime(trade.timestamp)}
                  </td>

                  {/* Token */}
                  <td className="px-4 py-3 border-b border-border-light font-bold text-black">
                    {trade.tokenSymbol}
                  </td>

                  {/* Side */}
                  <td className={`px-4 py-3 border-b border-border-light font-bold ${
                    trade.side === 'buy' ? 'text-color-up' : 'text-color-down'
                  }`}>
                    {trade.side === 'buy' ? 'Buy' : 'Sell'}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 border-b border-border-light text-right font-mono tabular-nums text-[12px] text-text-secondary">
                    <span className="text-black">{formatAmount18(trade.tokenAmount)}</span>
                    {' '}
                    <span className="text-text-muted text-[10px]">
                      (${formatAmount18(trade.usdcAmount, 2)})
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 border-b border-border-light text-right font-mono tabular-nums text-[12px] text-text-secondary">
                    {formatPrice(trade.price)}
                  </td>

                  {/* Fee */}
                  <td className="px-4 py-3 border-b border-border-light text-right font-mono tabular-nums text-[12px] text-text-muted">
                    {trade.feeAmount > 0n
                      ? `$${formatAmount18(trade.feeAmount, 2)}`
                      : '\u2014'}
                  </td>

                  {/* ITP(s) */}
                  <td className="px-4 py-3 border-b border-border-light text-[12px] text-text-secondary">
                    {itpLabels}
                  </td>

                  {/* Trade ID */}
                  <td className="px-4 py-3 border-b border-border-light font-mono text-[11px] text-text-muted">
                    #{trade.tradeId.toString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-3 border-t border-border-light text-[12px]">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className={`font-semibold px-2 py-1 ${page === 0 ? 'text-text-muted cursor-default' : 'text-black hover:text-text-secondary'}`}
          >
            Prev
          </button>
          <span className="text-text-secondary font-mono tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className={`font-semibold px-2 py-1 ${page >= totalPages - 1 ? 'text-text-muted cursor-default' : 'text-black hover:text-text-secondary'}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
