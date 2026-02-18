/**
 * Probability calibration for LLM-generated predictions.
 *
 * LLMs systematically overstate confidence in their predictions. This module
 * applies scaling to bring extreme probabilities toward 0.5, and anchors
 * toward market price when the model's own confidence is low.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute floor -- never claim impossibility. */
const PROB_FLOOR = 0.01

/** Absolute ceiling -- never claim certainty. */
const PROB_CEILING = 0.99

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/**
 * Calibrate a raw LLM probability to reduce overconfidence.
 *
 * Two corrections are applied in sequence:
 *  1. **Shrinkage toward 0.5** -- the raw probability is scaled by a factor
 *     derived from the model's self-reported confidence. Higher confidence
 *     means less shrinkage.
 *  2. **Market anchor** -- the calibrated value is blended with the current
 *     market price. When confidence is low (< 0.6), the market gets 40%
 *     weight; otherwise just 10%.
 *
 * @param rawProb    - LLM's raw P(YES), in [0, 1]
 * @param confidence - LLM's self-reported confidence, in [0, 1]
 * @param marketPrice - Current market implied probability, in [0, 1]
 * @returns Calibrated probability, unbounded (use {@link calibrateWithBounds}
 *          if you need hard [0.01, 0.99] clamping)
 */
export function calibrate(
  rawProb: number,
  confidence: number,
  marketPrice: number,
): number {
  // Scale factor: higher confidence = less shrinkage toward 0.5
  const scaleFactor = 0.1 + confidence * 0.85
  const calibrated = 0.5 + (rawProb - 0.5) * scaleFactor

  // Anchor toward market price when confidence is low
  const anchorWeight = confidence < 0.6 ? 0.4 : 0.1
  return calibrated * (1 - anchorWeight) + marketPrice * anchorWeight
}

/**
 * Calibrate and clamp to [0.01, 0.99].
 *
 * Wraps {@link calibrate} with hard bounds so the output never represents
 * absolute certainty or impossibility. This is the recommended entry point
 * for any downstream EV or Kelly calculations.
 *
 * @param rawProb    - LLM's raw P(YES), in [0, 1]
 * @param confidence - LLM's self-reported confidence, in [0, 1]
 * @param marketPrice - Current market implied probability, in [0, 1]
 * @returns Calibrated probability clamped to [0.01, 0.99]
 */
export function calibrateWithBounds(
  rawProb: number,
  confidence: number,
  marketPrice: number,
): number {
  const raw = calibrate(rawProb, confidence, marketPrice)
  return Math.max(PROB_FLOOR, Math.min(PROB_CEILING, raw))
}
