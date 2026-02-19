'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'

interface FillDetail {
  orderId: bigint
  side: number // 0=BUY, 1=SELL
  fillPrice: bigint
  fillAmount: bigint
  limitPrice: bigint
}

interface CostBasis {
  /** Total cost of all buys (18 decimals) */
  totalCost: bigint
  /** Total shares acquired through buys */
  totalSharesBought: bigint
  /** Volume-weighted average cost per share (18 decimals) */
  avgCostPerShare: bigint
  /** Total proceeds from all sells (18 decimals) */
  totalSellProceeds: bigint
  /** Total shares sold */
  totalSharesSold: bigint
  /** Realized P&L: sell proceeds minus proportional cost basis (18 decimals) */
  realizedPnL: bigint
  /** Per-order fill details */
  fills: FillDetail[]
}

interface UseItpCostBasisReturn {
  costBasis: CostBasis | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Aggregates all fills for a user across an ITP to compute cost basis.
 * Queries OrderSubmitted events for the user+itpId, then FillConfirmed events
 * for each order, and computes VWAP cost basis and realized P&L.
 */
export function useItpCostBasis(
  itpId: string | null,
  userAddress: string | null
): UseItpCostBasisReturn {
  const publicClient = usePublicClient()
  const [costBasis, setCostBasis] = useState<CostBasis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compute = useCallback(async () => {
    if (!publicClient || !itpId || !userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // 1. Query all OrderSubmitted events for this user+itpId
      const orderLogs = await publicClient.getLogs({
        address: INDEX_PROTOCOL.index,
        event: {
          type: 'event',
          name: 'OrderSubmitted',
          inputs: [
            { indexed: true, name: 'orderId', type: 'uint256' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: true, name: 'itpId', type: 'bytes32' },
            { indexed: false, name: 'pairId', type: 'bytes32' },
            { indexed: false, name: 'side', type: 'uint8' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: false, name: 'limitPrice', type: 'uint256' },
            { indexed: false, name: 'slippageTier', type: 'uint256' },
            { indexed: false, name: 'deadline', type: 'uint256' },
          ],
        },
        args: {
          user: userAddress as `0x${string}`,
          itpId: itpId as `0x${string}`,
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      if (orderLogs.length === 0) {
        setCostBasis(null)
        setIsLoading(false)
        return
      }

      // 2. Query all FillConfirmed events in one call (no filter — we'll match by orderId)
      const fillLogs = await publicClient.getLogs({
        address: INDEX_PROTOCOL.index,
        event: {
          type: 'event',
          name: 'FillConfirmed',
          inputs: [
            { indexed: true, name: 'orderId', type: 'uint256' },
            { indexed: true, name: 'cycleNumber', type: 'uint256' },
            { indexed: false, name: 'fillPrice', type: 'uint256' },
            { indexed: false, name: 'fillAmount', type: 'uint256' },
          ],
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      // Build fill lookup by orderId
      const fillMap = new Map<string, { fillPrice: bigint; fillAmount: bigint }>()
      for (const log of fillLogs) {
        const args = log.args as any
        fillMap.set(args.orderId.toString(), {
          fillPrice: args.fillPrice,
          fillAmount: args.fillAmount,
        })
      }

      // 3. Compute cost basis
      let totalCost = 0n
      let totalSharesBought = 0n
      let totalSellProceeds = 0n
      let totalSharesSold = 0n
      const fills: FillDetail[] = []

      for (const log of orderLogs) {
        const args = log.args as any
        const orderId = args.orderId as bigint
        const side = Number(args.side)
        const limitPrice = args.limitPrice as bigint
        const fillData = fillMap.get(orderId.toString())

        if (fillData) {
          fills.push({
            orderId,
            side,
            fillPrice: fillData.fillPrice,
            fillAmount: fillData.fillAmount,
            limitPrice,
          })

          if (side === 0) {
            // BUY: fillAmount is USDC spent, shares received = fillAmount / fillPrice
            totalCost += fillData.fillAmount
            if (fillData.fillPrice > 0n) {
              totalSharesBought += (fillData.fillAmount * BigInt(1e18)) / fillData.fillPrice
            }
          } else {
            // SELL: fillAmount is shares sold, USDC received = shares * fillPrice / 1e18
            totalSharesSold += fillData.fillAmount
            if (fillData.fillPrice > 0n) {
              totalSellProceeds += (fillData.fillAmount * fillData.fillPrice) / BigInt(1e18)
            }
          }
        }
      }

      const avgCostPerShare = totalSharesBought > 0n
        ? (totalCost * BigInt(1e18)) / totalSharesBought
        : 0n

      // Realized P&L = sell proceeds - (avgCostPerShare * sharesSold / 1e18)
      const costOfSold = totalSharesSold > 0n
        ? (avgCostPerShare * totalSharesSold) / BigInt(1e18)
        : 0n
      const realizedPnL = totalSellProceeds - costOfSold

      setCostBasis({
        totalCost,
        totalSharesBought,
        avgCostPerShare,
        totalSellProceeds,
        totalSharesSold,
        realizedPnL,
        fills,
      })
    } catch (e: any) {
      setError(e.message || 'Failed to compute cost basis')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, itpId, userAddress])

  useEffect(() => {
    compute()
    const interval = setInterval(compute, 15_000)
    return () => clearInterval(interval)
  }, [compute])

  return { costBasis, isLoading, error, refresh: compute }
}
