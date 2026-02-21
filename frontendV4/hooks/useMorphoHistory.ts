'use client'

import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface MorphoTx {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay'
  amount: string       // human-readable
  token: string        // ITP or USDC
  txHash: string
  blockNumber: bigint
  timestamp: number    // 0 if unknown
}

/**
 * Hook for Morpho lending history.
 *
 * Previously scanned 4 Morpho events (SupplyCollateral, WithdrawCollateral,
 * Borrow, Repay) via getLogs from block 0 — extremely heavy RPC call that
 * could time out or get rate-limited.
 *
 * Now returns an empty array until a `/morpho-history?address=...` REST
 * endpoint is added to the data-node that indexes these events server-side.
 *
 * TODO: Add /morpho-history endpoint to data-node that returns indexed
 *       Morpho events for a given user address. The data-node should scan
 *       events incrementally and store them in SQLite.
 */
export function useMorphoHistory(_market: MorphoMarketEntry | undefined) {
  return {
    txs: [] as MorphoTx[],
    isLoading: false,
    refetch: () => {},
  }
}
