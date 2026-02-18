/**
 * Expected value and Kelly criterion position sizing.
 *
 * Given our calibrated probability and the market's implied odds, compute
 * the expected value per unit bet and the optimal Kelly stake fraction.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EVResult {
  /** Our calibrated probability minus market probability. */
  edge: number
  /** Expected value per 1 WIND bet (positive = profitable). */
  ev: number
  /** Full Kelly fraction of bankroll to bet. */
  kellyFraction: number
  /** Half Kelly fraction (recommended for real use). */
  halfKelly: number
  /** True if edge exceeds the minimum threshold. */
  shouldBet: boolean
}

// ---------------------------------------------------------------------------
// EV calculation
// ---------------------------------------------------------------------------

/**
 * Calculate expected value and Kelly criterion sizing for a position.
 *
 * Uses the standard Kelly formula: `f = (p * b - q) / b`
 * where:
 *  - `p` = our estimated probability of winning
 *  - `q` = 1 - p (probability of losing)
 *  - `b` = net odds (payout per unit bet, excluding stake)
 *
 * For `oddsBps`, the basis-point representation maps as:
 *  - 10000 bps = 1.00x net payout (even money: bet 1, win 1 profit)
 *  - 20000 bps = 2.00x net payout (bet 1, win 2 profit)
 *  - 5000 bps  = 0.50x net payout (bet 1, win 0.5 profit)
 *
 * @param ourProb   - Our calibrated probability of the YES outcome, in (0, 1)
 * @param marketProb - Market's implied probability, in (0, 1)
 * @param oddsBps   - Odds in basis points (10000 = 1.00x net payout)
 * @param minEdge   - Minimum edge required to bet (default 0.02 = 2%)
 * @returns Sizing result with edge, EV, Kelly fractions, and bet decision
 */
export function calculateEV(
  ourProb: number,
  marketProb: number,
  oddsBps: number,
  minEdge: number = 0.02,
): EVResult {
  const p = ourProb
  const q = 1 - p
  const b = oddsBps / 10_000

  const edge = p - marketProb
  const ev = p * b - q

  // Kelly fraction: f = (p * b - q) / b
  // Clamp to [0, 1] -- negative Kelly means don't bet, and we never risk
  // more than the full bankroll.
  const rawKelly = (p * b - q) / b
  const kellyFraction = Math.max(0, Math.min(1, rawKelly))
  const halfKelly = kellyFraction / 2

  const shouldBet = edge > minEdge && ev > 0

  return {
    edge,
    ev,
    kellyFraction,
    halfKelly,
    shouldBet,
  }
}
