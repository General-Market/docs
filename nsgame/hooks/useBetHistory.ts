'use client'

// Historical bet stream for a specific wallet. Fetches from the
// indexer's /api/events/history/[owner] route and exposes the subset
// of fields the UI layer cares about.

import { useEffect, useState, useCallback, useRef } from 'react'
import type {
  HistoryRow,
  BetPlacedRow,
  BetExitedRow,
  ClaimedRow,
} from '@/lib/indexer/types'

export type BetStatus = 'placed' | 'exited' | 'resolved' | 'claimed'

export interface BetRecord {
  /** On-chain Position PDA — not provided by the indexer; left undefined until needed. */
  positionPda?: string
  /** On-chain Market PDA. */
  marketPda: string
  sourceId: number | null
  thresholdBps: number | null
  closeTime: string | null
  settlementTime: string | null
  /** 0 = YES, 1 = NO — applicable for BetPlaced/BetExited. */
  side: number | null
  /** Amount in raw stake-mint lamports (u64 as decimal string). */
  amount: string | null
  /** For Claimed rows. */
  netClaimed: string | null
  feePaid: string | null
  stranded: boolean | null
  claimed: boolean
  status: BetStatus
  lastTxSignature: string
  /** Unix seconds (bigint-as-string) or null when the slot's block time is unknown. */
  blockTime: string | null
}

interface UseBetHistoryOptions {
  address: string | undefined
  enabled?: boolean
}

interface UseBetHistoryReturn {
  bets: BetRecord[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

interface ApiResponse {
  events?: HistoryRow[]
  error?: string
}

function rowToRecord(r: HistoryRow): BetRecord {
  const meta = r.marketMeta
  const base = {
    marketPda: r.market,
    sourceId: meta?.sourceId ?? null,
    thresholdBps: meta?.thresholdBps ?? null,
    closeTime: meta?.closeTime ?? null,
    settlementTime: meta?.settlementTime ?? null,
    lastTxSignature: r.signature,
    blockTime: r.blockTime,
  }
  if (r.type === 'BetPlaced') {
    const p = r as BetPlacedRow
    return {
      ...base,
      side: p.side,
      amount: p.amount,
      netClaimed: null,
      feePaid: null,
      stranded: null,
      claimed: false,
      status: 'placed',
    }
  }
  if (r.type === 'BetExited') {
    const e = r as BetExitedRow
    return {
      ...base,
      side: e.side,
      amount: e.amount,
      netClaimed: null,
      feePaid: null,
      stranded: null,
      claimed: false,
      status: 'exited',
    }
  }
  const c = r as ClaimedRow
  return {
    ...base,
    side: null,
    amount: null,
    netClaimed: c.net,
    feePaid: c.fee,
    stranded: c.stranded,
    claimed: true,
    status: 'claimed',
  }
}

export function useBetHistory(opts: UseBetHistoryOptions): UseBetHistoryReturn {
  const { address, enabled = true } = opts
  const [bets, setBets] = useState<BetRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchNow = useCallback(async () => {
    if (!address || !enabled) {
      setBets([])
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/history/${encodeURIComponent(address)}`, {
        cache: 'no-store',
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`history fetch failed: ${res.status}`)
      const body = (await res.json()) as ApiResponse
      const rows = body.events ?? []
      setBets(rows.map(rowToRecord))
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return
      setError(e instanceof Error ? e : new Error(String(e)))
      setBets([])
    } finally {
      setIsLoading(false)
    }
  }, [address, enabled])

  useEffect(() => {
    fetchNow()
    return () => { abortRef.current?.abort() }
  }, [fetchNow])

  return {
    bets,
    isLoading,
    isError: error !== null,
    error,
    refetch: fetchNow,
  }
}
