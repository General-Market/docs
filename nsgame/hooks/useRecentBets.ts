'use client'

// Global feed of recent bet events. The old implementation pulled from
// an EVM backend that doesn't exist for the Solana build. The new
// program emits events the indexer can surface; until it ships, this
// hook is a no-op.
//
// TODO: wire to the Solana event indexer.

export type BetEventType =
  | 'BetPlaced'
  | 'BetExited'
  | 'MarketInstantiated'
  | 'MarketClosed'
  | 'MarketResolved'
  | 'Claimed'

export interface RecentBetEvent {
  eventType: BetEventType
  marketPda: string
  walletAddress: string
  sourceId: number
  thresholdBps: number
  amount: string
  timestamp: string
  signature: string
}

interface UseRecentBetsReturn {
  events: RecentBetEvent[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useRecentBets(_limit: number = 20): UseRecentBetsReturn {
  return {
    events: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => { /* no-op */ },
  }
}
