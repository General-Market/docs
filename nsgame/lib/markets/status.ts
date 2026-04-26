/**
 * Single source of truth for the market-list status taxonomy.
 *
 * Three buckets the UI exposes — and the only three the indexer / on-chain
 * decoder can actually distinguish:
 *
 *   live     — instantiated, the close window has not yet passed.
 *              Source: forward catalog cohort, with on-chain `resolved=false`
 *              (or the chain account simply not yet decoded). Bets accepted.
 *
 *   settling — close window has passed, oracle has not yet paid out.
 *              Source: indexer rows present in `market_instantiated` and
 *              absent from `market_resolved`. The intermediate purgatory.
 *
 *   resolved — keeper paid out. `market_resolved` row present (or chain
 *              account decoded with `resolved=true`).
 *
 * Raw indexer columns mapped here, naming so nothing else has to guess:
 *
 *   close_time          → boundary between `live` and `settling`
 *   market_resolved row → boundary between `settling` and `resolved`
 *
 * `MarketState.resolved` mirrors the on-chain flag and supersedes any
 * indexer state for the same PDA — the chain wins ties.
 */

import type { MarketState } from './hooks'

export type MarketStatus = 'live' | 'settling' | 'resolved'

export interface DeriveStatusInput {
  /** Unix seconds. The market's close window. */
  closeTime: number
  /** Decoded chain account, if we have one. Null when the program has not
   *  yet seen any bet (account uncreated). */
  state: MarketState | null
  /** Unix seconds. The wall-clock the caller is reasoning against. Pass
   *  zero only during initial hydration — derivation degrades to `live`
   *  as the safest default in that window. */
  nowSecs: number
}

export function deriveStatus({ closeTime, state, nowSecs }: DeriveStatusInput): MarketStatus {
  if (state?.resolved) return 'resolved'
  if (nowSecs <= 0) return 'live'
  if (closeTime <= nowSecs) return 'settling'
  return 'live'
}

/**
 * Header copy keyed by the active filter set. Header is a separate concern
 * from derivation so we can render it before any rows have arrived.
 *
 * Cioran register: short, declarative, no warmth.
 *
 *   ()           — nothing checked, default upcoming framing
 *   (live)       — only live
 *   (settling)   — only settling
 *   (resolved)   — only resolved
 *   (mixed)      — two or three checked, no single mood applies
 */
export interface HeaderCopy {
  title: string
  subtitle: string
}

export function headerForStatuses(statuses: readonly MarketStatus[]): HeaderCopy {
  if (statuses.length === 0) {
    return {
      title: 'Closing soon',
      subtitle: 'Pick a side. The keeper pays out when the answer arrives.',
    }
  }
  if (statuses.length === 1) {
    const only = statuses[0]
    if (only === 'live') {
      return {
        title: 'Open for bets',
        subtitle: 'The window is still open. Pick a side before it closes.',
      }
    }
    if (only === 'settling') {
      return {
        title: 'Awaiting the keeper',
        subtitle: 'The window closed. Nothing to do but wait for the price.',
      }
    }
    return {
      title: 'Already settled',
      subtitle: 'The window closed. The price decided. The keeper paid.',
    }
  }
  return {
    title: 'Markets',
    subtitle: 'Some open, some closing, some already over.',
  }
}
