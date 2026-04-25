'use client'

/**
 * Stub shim. The real implementation lives in `./hooks`. This file remains
 * only so any UI module that imported the stub during the construction
 * period continues to compile. New code should import from `./hooks`.
 */

export {
  useUpcomingSlots,
  useMarketState,
  useRecentBets,
  usePlaceBet,
} from './hooks'

export type {
  UpcomingSlot,
  MarketState,
  RecentBet,
  UseUpcomingSlotsOpts,
  UsePlaceBetReturn,
} from './hooks'
