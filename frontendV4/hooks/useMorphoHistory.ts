'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { DATA_NODE_URL } from '@/lib/config'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface MorphoTx {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay'
  amount: string       // human-readable
  token: string        // ITP or USDC
  txHash: string
  blockNumber: bigint
  timestamp: number    // 0 if unknown
}

interface RawMorphoEvent {
  event_type: string
  amount: string
  token: string
  tx_hash: string
  block_number: number
  timestamp?: number
}

/**
 * Hook for Morpho lending history.
 *
 * Fetches from the data-node `/morpho-history?address=...` endpoint which
 * indexes Morpho events (SupplyCollateral, WithdrawCollateral, Borrow, Repay)
 * server-side in SQLite.
 */
export function useMorphoHistory(_market: MorphoMarketEntry | undefined) {
  const { address } = useAccount()
  const [txs, setTxs] = useState<MorphoTx[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const addressRef = useRef(address)

  useEffect(() => { addressRef.current = address }, [address])

  const refetch = useCallback(async () => {
    const user = addressRef.current
    if (!user) {
      setTxs([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(
        `${DATA_NODE_URL}/morpho-history?address=${user}`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (!res.ok) {
        setTxs([])
        return
      }
      const raw: RawMorphoEvent[] = await res.json()
      const mapped: MorphoTx[] = raw.map((e) => ({
        type: e.event_type as MorphoTx['type'],
        amount: e.amount,
        token: e.token,
        txHash: e.tx_hash,
        blockNumber: BigInt(e.block_number),
        timestamp: e.timestamp ?? 0,
      }))
      setTxs(mapped)
    } catch {
      // Network error — keep previous txs if any
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on mount and when address changes
  useEffect(() => {
    setTxs([])
    refetch()
  }, [address, refetch])

  // Poll every 30s for new events
  useEffect(() => {
    if (!address) return
    const interval = setInterval(refetch, 30_000)
    return () => clearInterval(interval)
  }, [address, refetch])

  return { txs, isLoading, refetch }
}
