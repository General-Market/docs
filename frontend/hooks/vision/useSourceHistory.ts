'use client'

import { useQuery } from '@tanstack/react-query'

export interface SourceBatch {
  batchId: number
  status: 'open' | 'settled'
  playerCount: number
  totalPool: number
  avgPnl: number
  /** Top earner's net P&L (signed). */
  topEarnerPnl?: number
  /** Largest gross payout in the round (>= 0). */
  topPayout?: number
  topEarnerAddress?: string | null
  timestamp: string
  bettingStart?: string | null
  bettingEnd?: string | null
  settledAt?: string | null
  marketCount?: number | null
}

export interface HistoryResponse {
  batches: SourceBatch[]
  page: number
  perPage: number
  totalSettled: number
  totalPages: number
}

const EMPTY: HistoryResponse = { batches: [], page: 1, perPage: 10, totalSettled: 0, totalPages: 0 }

export async function fetchSourceHistory(sourceId: string, page = 1): Promise<HistoryResponse> {
  const res = await fetch(`/api/vision/source/${encodeURIComponent(sourceId)}/history?page=${page}&per_page=10`)
  if (!res.ok) return EMPTY
  return res.json()
}

/** Settled-round history for a source, newest first. Shared cache key with
 *  BatchHistory so the page makes a single request per source/page. */
export function useSourceHistory(sourceId: string | undefined, page = 1) {
  return useQuery<HistoryResponse>({
    queryKey: ['source-history', sourceId, page],
    queryFn: () => fetchSourceHistory(sourceId as string, page),
    enabled: !!sourceId,
    refetchInterval: 15_000,
  })
}

export interface LatestSettledRound {
  batchId: number
  pool: number
  players: number
  /** Epoch ms the round settled, or null when the oracle omitted it. */
  settledAtMs: number | null
}

/** The most recently settled round for a source — the round that closed just
 *  before the live one. Pool is the real on-chain deposit total in USDC.
 *  Recency is left to the caller: a source whose settlements have frozen will
 *  return a stale round here, so the timeline gates it against the tick length. */
export function useLatestSettledRound(sourceId: string | undefined): LatestSettledRound | null {
  const { data } = useSourceHistory(sourceId, 1)
  const latest = data?.batches?.find(b => b.status === 'settled') ?? data?.batches?.[0]
  if (!latest) return null
  const settledAt = latest.settledAt ?? latest.timestamp
  const ms = settledAt ? new Date(settledAt).getTime() : NaN
  return {
    batchId: latest.batchId,
    pool: latest.totalPool,
    players: latest.playerCount,
    settledAtMs: Number.isFinite(ms) ? ms : null,
  }
}
