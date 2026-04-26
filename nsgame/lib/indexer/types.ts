// Wire types shared between API routes and React hooks.
//
// The on-chain values are large integers (u64/u128) and arrive from
// Postgres as strings; keep them as strings across the wire so the JS
// side never silently loses precision.

export type BetSide = 0 | 1   // 0 = YES, 1 = NO

export interface MarketMeta {
  market: string
  sourceId: number | null
  thresholdBps: number | null
  closeTime: string | null        // unix seconds (bigint string)
  settlementTime: string | null
  creator: string | null
  resolved: boolean
  outcomeYes: boolean | null
  finalPrice: string | null       // u128 as decimal string
  baselinePrice: string | null
  forceResolved: boolean | null
  /** Cumulative YES pool, summed across every bet on this market. u64 string. */
  totalYes?: string | null
  /** Cumulative NO pool, summed across every bet on this market. u64 string. */
  totalNo?: string | null
}

export interface BetPlacedRow {
  type: 'BetPlaced'
  signature: string
  slot: string
  blockTime: string | null
  market: string
  owner: string
  side: BetSide
  amount: string
  marketMeta?: MarketMeta
}

export interface BetExitedRow {
  type: 'BetExited'
  signature: string
  slot: string
  blockTime: string | null
  market: string
  owner: string
  side: BetSide
  amount: string
  marketMeta?: MarketMeta
}

export interface ClaimedRow {
  type: 'Claimed'
  signature: string
  slot: string
  blockTime: string | null
  market: string
  owner: string
  net: string
  fee: string
  stranded: boolean
  marketMeta?: MarketMeta
}

export interface MarketResolvedRow {
  type: 'MarketResolved'
  signature: string
  slot: string
  blockTime: string | null
  market: string
  baselinePrice: string
  finalPrice: string
  outcomeYes: boolean
  forceResolved: boolean
}

export type HistoryRow = BetPlacedRow | BetExitedRow | ClaimedRow
export type StreamRow  = BetPlacedRow | ClaimedRow | MarketResolvedRow
