'use client'

/**
 * Stub shim. The real implementation lives in `./hooks`. This file remains
 * only so any UI module that imported the stub during the construction
 * period continues to compile. New code should import from `./hooks`.
 */

export {
  useUpcomingSlots,
  useMarketState,
  useMarketStatesBatch,
  useRecentBets,
  usePlaceBet,
  useSourcePrice,
} from './hooks'

export type {
  UpcomingSlot,
  MarketState,
  MarketStateMap,
  RecentBet,
  SourcePrice,
  UseUpcomingSlotsOpts,
  UsePlaceBetReturn,
} from './hooks'
