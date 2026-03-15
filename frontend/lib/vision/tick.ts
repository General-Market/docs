/**
 * Tick timing utilities for Vision batches.
 *
 * Each category has its own tick duration based on how frequently
 * the underlying data sources refresh. Batches within the same
 * category are staggered by a per-batch offset so they don't all
 * end at the same second.
 */

import { type SourceCategory } from '@/lib/vision/sources'

// Legacy global default tick duration (seconds)
export const TICK_DURATION = 30

/**
 * Tick duration per source category (seconds).
 * Matches data-node sync intervals so ticks align with real data refreshes.
 */
const CATEGORY_TICK_DURATION: Record<SourceCategory, number> = {
  finance:       600,   // 10 min — crypto, stocks, DeFi
  economic:      3600,  // 1 hr  — FRED rates, treasury, central banks
  regulatory:    3600,  // 1 hr  — SEC, congress, court filings
  tech:          300,   // 5 min — GitHub, npm, PyPI, crates.io
  academic:      1800,  // 30 min — OpenAlex, Crossref
  entertainment: 120,   // 2 min — Twitch, AniList, Steam, TMDB
  geophysical:   300,   // 5 min — weather, earthquake, volcano
  transport:     120,   // 2 min — flights, ships, transit, traffic
  nature:        600,   // 10 min — eBird, air quality, shelters
  space:         300,   // 5 min — ISS, solar wind
}

/** Get the tick duration for a source category */
export function getCategoryTickDuration(category: SourceCategory): number {
  return CATEGORY_TICK_DURATION[category] ?? 600
}

/** Compute current tick state from epoch time. Stable across page loads. */
export function getTickState(now: number = Date.now()) {
  const epochSec = Math.floor(now / 1000)
  const elapsed = epochSec % TICK_DURATION
  const remaining = TICK_DURATION - elapsed
  return { elapsed, remaining }
}

/** Compute tick state for a specific tick duration. */
export function getBatchTickState(tickDuration: number) {
  const now = Math.floor(Date.now() / 1000)
  const elapsed = now % tickDuration
  const remaining = tickDuration - elapsed
  return { elapsed, remaining, tickDuration }
}

/** Format seconds into human-readable duration */
export function formatTickDuration(secs: number): string {
  if (secs >= 3600) return `${(secs / 3600).toFixed(0)}h`
  if (secs >= 60) return `${(secs / 60).toFixed(0)}m`
  return `${secs}s`
}
