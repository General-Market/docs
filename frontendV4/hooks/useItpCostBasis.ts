'use client'

import { useSSECostBasis } from './useSSE'

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
 * Reads from the SSE `userCostBasis` stream (pre-computed by data-node).
 */
export function useItpCostBasis(
  itpId: string | null,
  userAddress: string | null
): UseItpCostBasisReturn {
  const cb = useSSECostBasis()

  if (!cb || !itpId || !userAddress) {
    return {
      costBasis: null,
      isLoading: !cb && !!itpId && !!userAddress,
      error: null,
      refresh: async () => {},
    }
  }

  const costBasis: CostBasis = {
    totalCost: BigInt(cb.total_cost || '0'),
    totalSharesBought: BigInt(cb.total_shares_bought || '0'),
    avgCostPerShare: BigInt(cb.avg_cost_per_share || '0'),
    totalSellProceeds: BigInt(cb.total_sell_proceeds || '0'),
    totalSharesSold: BigInt(cb.total_shares_sold || '0'),
    realizedPnL: BigInt(cb.realized_pnl || '0'),
    fills: (cb.fills || []).map((f) => ({
      orderId: BigInt(f.order_id),
      side: f.side,
      fillPrice: BigInt(f.fill_price),
      fillAmount: BigInt(f.fill_amount),
      limitPrice: BigInt(f.limit_price),
    })),
  }

  return { costBasis, isLoading: false, error: null, refresh: async () => {} }
}
