/**
 * Research result aggregator.
 *
 * When the same market is researched multiple times we want to combine
 * the results rather than just overwriting.  This module provides
 * confidence-weighted averaging with diminishing returns so that
 * repeated research narrows the estimate without giving false
 * certainty.
 */

import type { ResearchResult } from '../types'

const STALENESS_THRESHOLD_MS = 12 * 60 * 60 * 1000 // 12 hours

/**
 * Merge an incoming research result with a possibly-existing prior result.
 *
 * Rules:
 *  - No existing result -> return incoming as-is.
 *  - Existing result older than 12 h -> replace with incoming.
 *  - Otherwise -> weighted average by confidence.
 */
export function aggregateResearch(
  existing: ResearchResult | null,
  incoming: ResearchResult,
): ResearchResult {
  // First research for this market — nothing to aggregate.
  if (existing === null) {
    return incoming
  }

  // If the incoming result is older than the existing one, keep existing
  // unless existing itself is stale (>12h old).
  const age = incoming.researchedAt - existing.researchedAt
  if (age < 0) {
    const existingAge = Date.now() - existing.researchedAt
    if (existingAge > STALENESS_THRESHOLD_MS) {
      return incoming
    }
    return existing
  }

  // If the existing result is stale, replace entirely.
  if (age > STALENESS_THRESHOLD_MS) {
    return incoming
  }

  // Confidence-weighted average of probYes
  const totalWeight = existing.confidence + incoming.confidence
  const probYes =
    totalWeight > 0
      ? (existing.probYes * existing.confidence +
          incoming.probYes * incoming.confidence) /
        totalWeight
      : incoming.probYes

  // Diminishing returns on combined confidence
  const confidence = Math.min(1, totalWeight * 0.7)

  // Use latest reasoning, merge and deduplicate sources
  const sources = [
    ...new Set([...existing.sources, ...incoming.sources]),
  ]

  return {
    marketId: incoming.marketId,
    source: incoming.source,
    question: incoming.question,
    probYes,
    confidence,
    reasoning: incoming.reasoning,
    sources,
    researchedAt: incoming.researchedAt,
    expiresAt: incoming.expiresAt,
  }
}
