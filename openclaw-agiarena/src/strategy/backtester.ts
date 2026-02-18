/**
 * Historical simulation engine for strategy evaluation.
 *
 * Replays resolved bets to measure the edge of AI-researched positions
 * against random/uninformed positions. Supports hypothetical strategy
 * changes via pluggable calibrator functions for A/B comparison.
 */

import type { ResearchStore } from '../research/store'
import type { BetRecord, PortfolioPosition } from '../types'
import { calibrate } from './calibrator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacktestResult {
  totalBets: number
  aiWinRate: number       // Win rate of AI-researched positions
  randomWinRate: number   // Win rate of random positions
  overallWinRate: number
  profitLoss: number      // Simulated P&L in WIND
  sharpeEstimate: number  // Annualized Sharpe ratio estimate
}

/** Signature for a custom calibration function used in hypothetical backtests. */
export type CalibrateFn = (
  rawProb: number,
  confidence: number,
  marketPrice: number,
) => number

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum confidence to classify a position as AI-informed. */
const AI_CONFIDENCE_THRESHOLD = 0.5

/** Annualization factor (approximate trading days in a year). */
const ANNUALIZATION_FACTOR = Math.sqrt(252)

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Separate positions into AI-informed and random buckets.
 *
 * A position is considered AI-informed if its confidence exceeds the
 * threshold (> 0.5). Everything else is classified as random/uninformed.
 */
function classifyPositions(
  positions: PortfolioPosition[],
): { ai: PortfolioPosition[]; random: PortfolioPosition[] } {
  const ai: PortfolioPosition[] = []
  const random: PortfolioPosition[] = []

  for (const pos of positions) {
    if (pos.confidence > AI_CONFIDENCE_THRESHOLD) {
      ai.push(pos)
    } else {
      random.push(pos)
    }
  }

  return { ai, random }
}

/**
 * Calculate standard deviation of an array of numbers.
 * Returns 0 for empty or single-element arrays to avoid division by zero.
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.reduce(
    (sum, v) => sum + (v - mean) ** 2,
    0,
  )

  return Math.sqrt(squaredDiffs / (values.length - 1))
}

/**
 * Compute aggregate backtest metrics from classified bet results.
 */
function computeMetrics(
  settledBets: BetRecord[],
): BacktestResult {
  if (settledBets.length === 0) {
    return {
      totalBets: 0,
      aiWinRate: 0,
      randomWinRate: 0,
      overallWinRate: 0,
      profitLoss: 0,
      sharpeEstimate: 0,
    }
  }

  let aiWins = 0
  let aiTotal = 0
  let randomWins = 0
  let randomTotal = 0
  let overallWins = 0
  const pnlValues: number[] = []

  for (const bet of settledBets) {
    const pnl = bet.pnl ?? 0
    pnlValues.push(pnl)

    const isWin = pnl > 0
    if (isWin) overallWins++

    const { ai, random } = classifyPositions(bet.positions)

    // Count AI-informed position wins: if the bet is profitable and it
    // has AI-informed positions, those positions contributed to the win.
    aiTotal += ai.length
    randomTotal += random.length

    if (isWin) {
      aiWins += ai.length
      randomWins += random.length
    }
  }

  const profitLoss = pnlValues.reduce((sum, v) => sum + v, 0)

  // Win rates as proportions (0-1)
  const aiWinRate = aiTotal > 0 ? aiWins / aiTotal : 0
  const randomWinRate = randomTotal > 0 ? randomWins / randomTotal : 0
  const overallWinRate = settledBets.length > 0
    ? overallWins / settledBets.length
    : 0

  // Annualized Sharpe estimate: mean(pnl) / std(pnl) * sqrt(252)
  const meanPnl = profitLoss / pnlValues.length
  const pnlStd = stddev(pnlValues)
  const sharpeEstimate = pnlStd > 0
    ? (meanPnl / pnlStd) * ANNUALIZATION_FACTOR
    : 0

  return {
    totalBets: settledBets.length,
    aiWinRate,
    randomWinRate,
    overallWinRate,
    profitLoss,
    sharpeEstimate,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Backtest the current strategy against resolved bets.
 *
 * Retrieves all settled bets from the store, classifies each bet's
 * positions into AI-informed vs random, and computes win rates, P&L,
 * and a rough annualized Sharpe ratio for each category.
 *
 * @param store - Research store containing settled bet records
 * @returns Aggregated backtest metrics
 */
export function backtest(store: ResearchStore): BacktestResult {
  const settledBets = store.getBets({ status: 'settled' })
  return computeMetrics(settledBets)
}

/**
 * Backtest a hypothetical calibrator change.
 *
 * Re-simulates all resolved bets using a custom calibration function
 * instead of the production calibrator. For each settled bet, looks up
 * the original research data and re-evaluates what position the custom
 * calibrator would have selected. Compares hypothetical outcomes against
 * actual settlement results.
 *
 * This enables offline evaluation of calibrator parameter changes before
 * deploying them to production.
 *
 * @param store           - Research store with settled bets and research data
 * @param customCalibrate - Alternative calibration function to evaluate
 * @returns Backtest metrics under the hypothetical calibrator
 */
export function backtestWithStrategy(
  store: ResearchStore,
  customCalibrate: CalibrateFn,
): BacktestResult {
  const settledBets = store.getBets({ status: 'settled' })

  if (settledBets.length === 0) {
    return {
      totalBets: 0,
      aiWinRate: 0,
      randomWinRate: 0,
      overallWinRate: 0,
      profitLoss: 0,
      sharpeEstimate: 0,
    }
  }

  // Build a lookup of research results for market-level re-evaluation.
  // We use all research (including expired) because settled bets may
  // reference research that has since expired.
  const allResearch = new Map(
    store.getAllResearch().map((r) => [r.marketId, r]),
  )

  // Re-simulate each bet with the custom calibrator
  const simulatedBets: BetRecord[] = settledBets.map((bet) => {
    const simulatedPositions: PortfolioPosition[] = bet.positions.map((pos) => {
      const research = allResearch.get(pos.marketId)

      if (!research || research.confidence <= AI_CONFIDENCE_THRESHOLD) {
        // No research available or low confidence -- position stays random.
        // Confidence stays at its original value (random = 0).
        return { ...pos }
      }

      // Re-calibrate with the custom function.
      // Use the oddsBps-derived market price as the market reference.
      // oddsBps / 10000 gives the implied probability from the odds.
      const marketPrice = bet.oddsBps / 10_000
      const recalibrated = customCalibrate(
        research.probYes,
        research.confidence,
        Math.min(1, Math.max(0, marketPrice)),
      )

      // Determine what side the custom calibrator would have chosen
      const wouldChooseYes = recalibrated > 0.5
      const originalIsYes = pos.position === 'YES' || pos.position === 'LONG'

      // If the custom calibrator agrees with the original position,
      // the pnl outcome stays the same. If it disagrees, the position
      // flips, and we invert the contribution.
      const sameDirection = wouldChooseYes === originalIsYes

      return {
        ...pos,
        confidence: research.confidence,
        // Track whether the strategy would have agreed
        _sameDirection: sameDirection,
      } as PortfolioPosition & { _sameDirection?: boolean }
    })

    // Determine simulated P&L: if all AI-informed positions would have
    // been in the same direction, the P&L is the same. If any would have
    // flipped, we need to estimate the impact.
    const originalPnl = bet.pnl ?? 0
    const aiPositions = simulatedPositions.filter(
      (p) => p.confidence > AI_CONFIDENCE_THRESHOLD,
    )

    if (aiPositions.length === 0) {
      // No AI positions -- P&L is unchanged
      return { ...bet, positions: simulatedPositions }
    }

    // Count how many AI positions would have been different
    const flippedCount = (aiPositions as (PortfolioPosition & { _sameDirection?: boolean })[])
      .filter((p) => p._sameDirection === false).length
    const totalAi = aiPositions.length

    if (flippedCount === 0) {
      // Custom calibrator agrees with all AI positions -- same outcome
      return { ...bet, positions: simulatedPositions }
    }

    // Estimate adjusted P&L. The AI-informed fraction of the bet is
    // (informedCount / totalCount). If some of those flip, we estimate
    // the P&L change proportionally.
    const informedFraction = bet.totalCount > 0
      ? bet.informedCount / bet.totalCount
      : 0
    const flippedFraction = flippedCount / totalAi

    // Flipped positions would have had opposite P&L contribution.
    // Adjust: subtract 2x the flipped portion's contribution
    // (once to remove the original, once to add the inverse).
    const adjustedPnl = originalPnl - 2 * originalPnl * informedFraction * flippedFraction

    return {
      ...bet,
      positions: simulatedPositions,
      pnl: adjustedPnl,
    }
  })

  return computeMetrics(simulatedBets)
}
