'use client'

// Historical bet stream for a specific wallet. The old implementation
// fetched from an EVM backend; the new program emits its own events
// (`BetPlaced`, `BetExited`, `MarketInstantiated`, `MarketClosed`,
// `MarketResolved`, `Claimed`). Until an indexer subscribes to them,
// this hook returns empty arrays so consumers keep compiling.
//
// TODO: wire to a Solana event indexer (Helius or custom) once the
// program is deployed. Backend shape is intentionally unspecified here
// — the indexer layer will dictate it.

export type BetStatus = 'placed' | 'exited' | 'resolved' | 'claimed'

export interface BetRecord {
  /** On-chain Position PDA. */
  positionPda: string
  /** On-chain Market PDA. */
  marketPda: string
  /** Market params, as signed into the Market PDA seeds. */
  sourceId: number
  thresholdBps: number
  closeTime: bigint
  settlementTime: bigint
  /** Raw position amounts (lamports of the stake mint). */
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
  status: BetStatus
  /** Transaction signature of the most recent tx touching this position. */
  lastTxSignature?: string
  timestamp: number
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

export function useBetHistory(_opts: UseBetHistoryOptions): UseBetHistoryReturn {
  // Intentional no-op until an indexer ships.
  return {
    bets: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => { /* no-op */ },
  }
}
