/**
 * Portfolio construction from research and market data.
 *
 * Builds a complete portfolio of positions for a given trade list. Markets
 * with high-confidence research use calibrated probabilities and EV-based
 * side selection. Markets without research fall back to random coin-flip
 * selection (matching existing AA bot behaviour for uninformed positions).
 */

import type { ResearchStore } from '../research/store'
import type { Portfolio, PortfolioPosition, ScoredPosition } from '../types'
import { calibrateWithBounds } from './calibrator'
import { calculateEV } from './ev-calculator'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum confidence required to use research instead of random. */
const MIN_CONFIDENCE = 0.5

/** Sources that use LONG/SHORT instead of YES/NO. */
const CRYPTO_SOURCES = new Set(['coingecko', 'dex_tracker'])

// ---------------------------------------------------------------------------
// Portfolio builder
// ---------------------------------------------------------------------------

/**
 * Build an informed portfolio from a trade list and research store.
 *
 * For markets with research (confidence >= 0.5), calibrated probabilities
 * drive side selection. For markets without research or with low confidence,
 * a random coin flip decides the side -- replicating the existing AA bot
 * baseline.
 *
 * **Critical**: the positions array is returned in the same order as the
 * `tradeList` input, because downstream bitmap encoding relies on index
 * correspondence.
 *
 * @param tradeList - Ordered list of markets to build positions for
 * @param store     - Research store to look up cached predictions
 * @param oddsBps   - Odds in basis points for EV calculation (default 10000)
 * @returns A complete portfolio with informed/total counts
 */
export function buildInformedPortfolio(
  tradeList: { id: string; marketPrice: number; source: string }[],
  store: ResearchStore,
  oddsBps: number = 10_000,
): Portfolio {
  const positions: PortfolioPosition[] = []
  let informedCount = 0

  for (const trade of tradeList) {
    const research = store.getResearch(trade.id)

    if (research && research.confidence >= MIN_CONFIDENCE) {
      // --- Informed position ---
      const calibrated = calibrateWithBounds(
        research.probYes,
        research.confidence,
        trade.marketPrice,
      )

      const isCrypto = CRYPTO_SOURCES.has(trade.source)
      const side = calibrated > 0.5
        ? (isCrypto ? 'LONG' : 'YES')
        : (isCrypto ? 'SHORT' : 'NO')

      positions.push({
        marketId: trade.id,
        position: side,
        confidence: research.confidence,
      })

      informedCount++
    } else {
      // --- Random position (AA bot baseline) ---
      const isCrypto = CRYPTO_SOURCES.has(trade.source)
      const coinFlip = Math.random() > 0.5
      const side = coinFlip
        ? (isCrypto ? 'LONG' : 'YES')
        : (isCrypto ? 'SHORT' : 'NO')

      positions.push({
        marketId: trade.id,
        position: side,
        confidence: 0,
      })
    }
  }

  return {
    positions,
    createdAt: new Date().toISOString(),
    informedCount,
    totalCount: tradeList.length,
  }
}

// ---------------------------------------------------------------------------
// Top scored positions
// ---------------------------------------------------------------------------

/**
 * Score all non-expired researched positions and return top N by expected
 * value.
 *
 * Retrieves all active research from the store, calibrates each probability
 * against a neutral 0.5 market baseline, computes EV and Kelly sizing, and
 * returns the highest-EV positions sorted descending.
 *
 * @param store   - Research store with cached predictions
 * @param oddsBps - Odds in basis points (10000 = even money)
 * @param topN    - Maximum number of positions to return (default 20)
 * @returns Sorted array of scored positions, best first
 */
export function getTopPositions(
  store: ResearchStore,
  oddsBps: number,
  topN: number = 20,
): ScoredPosition[] {
  const allResearch = store.getActiveResearch()

  const scored: ScoredPosition[] = []

  for (const research of allResearch) {
    // Look up stored odds for this market, fall back to 0.5
    const oddsRaw = store.getConfig(`odds:${research.marketId}`)
    const storedOdds = oddsRaw !== null ? parseFloat(oddsRaw) : NaN
    const marketProb = Number.isNaN(storedOdds) ? 0.5 : storedOdds

    const calibrated = calibrateWithBounds(
      research.probYes,
      research.confidence,
      marketProb,
    )

    const ev = calculateEV(calibrated, marketProb, oddsBps)

    if (!ev.shouldBet) continue

    // Determine side based on where our calibrated probability sits
    const isCrypto = CRYPTO_SOURCES.has(research.source)
    const side = calibrated > 0.5
      ? (isCrypto ? 'LONG' : 'YES')
      : (isCrypto ? 'SHORT' : 'NO')

    scored.push({
      marketId: research.marketId,
      position: side,
      calibratedProb: calibrated,
      edge: ev.edge,
      halfKelly: ev.halfKelly,
      confidence: research.confidence,
      reasoning: research.reasoning,
    })
  }

  // Sort by absolute edge descending (best opportunities first)
  scored.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))

  return scored.slice(0, topN)
}
