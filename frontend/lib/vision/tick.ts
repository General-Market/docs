/**
 * Tick timing utilities for Vision batches.
 *
 * Each category has its own tick duration based on how frequently
 * the underlying data sources refresh. Batches within the same
 * category are staggered by a per-batch offset so they don't all
 * end at the same second.
 */

import batchConfig from '@/lib/contracts/vision-batches.json'
import { VISION_SOURCES, type SourceCategory, getVisionSourceId } from '@/lib/vision/sources'

// Legacy global values (kept for backward compat where needed)
export const TICK_DURATION = batchConfig.tickDuration  // 30 seconds
export const LOCK_OFFSET = batchConfig.lockOffset      // 5 seconds

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

/** Lock offset = 25% of tick, min 5s */
function lockOffsetForDuration(tickDuration: number): number {
  return Math.max(5, Math.floor(tickDuration * 0.25))
}

/** Get the tick duration for a source category */
export function getCategoryTickDuration(category: SourceCategory): number {
  return CATEGORY_TICK_DURATION[category] ?? 600
}

/**
 * Per-batch offset (seconds) to stagger batches in the same category.
 * Uses batchId * a prime to spread evenly within the tick window.
 */
function getBatchOffset(batchId: number, tickDuration: number): number {
  return (batchId * 17) % tickDuration
}

/** Compute current tick state from epoch time. Stable across page loads. */
export function getTickState(now: number = Date.now()) {
  const epochSec = Math.floor(now / 1000)
  const elapsed = epochSec % TICK_DURATION
  const remaining = TICK_DURATION - elapsed
  const isLocked = remaining <= LOCK_OFFSET
  return { elapsed, remaining, isLocked }
}

/** Compute tick state for a specific batch with its own duration + offset */
export function getBatchTickState(
  batchId: number,
  category: SourceCategory,
  now: number = Date.now(),
  tickDurationOverride?: number,
) {
  const tickDuration = tickDurationOverride ?? CATEGORY_TICK_DURATION[category] ?? 600
  const lock = lockOffsetForDuration(tickDuration)
  const offset = getBatchOffset(batchId, tickDuration)
  const epochSec = Math.floor(now / 1000)
  const elapsed = (epochSec + offset) % tickDuration
  const remaining = tickDuration - elapsed
  const isLocked = remaining <= lock
  return { elapsed, remaining, isLocked, tickDuration, lockOffset: lock }
}

/**
 * Early-entry multiplier: decreases linearly from 2.00x at tick start
 * to 1.00x at lock time. Returns 0 when locked (can't bet).
 */
export function getMultiplier(elapsed: number, tickDuration: number = TICK_DURATION, lock: number = LOCK_OFFSET): { value: number; label: string } {
  const bettingWindow = tickDuration - lock
  if (elapsed >= bettingWindow) {
    return { value: 0, label: 'LOCKED' }
  }
  const ratio = 1 - elapsed / bettingWindow
  const value = 1 + ratio
  return { value, label: `${value.toFixed(2)}x` }
}

/** Reverse map: batchId → source key (e.g. 0 → "coingecko") */
const batchIdToSourceKey: Record<number, string> = {}
for (const [key, entry] of Object.entries(batchConfig.batches)) {
  batchIdToSourceKey[(entry as { batchId: number }).batchId] = key
}

/** Get source key for a batch ID */
export function getSourceKeyForBatch(batchId: number): string | undefined {
  return batchIdToSourceKey[batchId]
}

/** Get display name for a batch ID using VISION_SOURCES */
export function getBatchDisplayName(batchId: number): string {
  const key = batchIdToSourceKey[batchId]
  if (!key) return `Batch #${batchId}`
  // Batch keys are data-node names (e.g. "stocks"), map to frontend IDs (e.g. "finnhub")
  const frontendId = getVisionSourceId(key)
  const source = VISION_SOURCES.find(s => s.id === frontendId)
  return source?.name ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

/** Get logo path for a batch ID */
export function getBatchLogo(batchId: number): string | undefined {
  const key = batchIdToSourceKey[batchId]
  if (!key) return undefined
  const frontendId = getVisionSourceId(key)
  const source = VISION_SOURCES.find(s => s.id === frontendId)
  return source?.logo
}

export interface StaticBatch {
  batchId: number
  sourceKey: string
  displayName: string
  logo?: string
  configHash: string
  category: SourceCategory
  tickDuration: number
}

/** All batches from the static config, enriched with display names and per-category tick durations. */
export function getAllBatches(): StaticBatch[] {
  return Object.entries(batchConfig.batches).map(([key, entry]) => {
    const e = entry as { batchId: number; configHash: string }
    const frontendId = getVisionSourceId(key)
    const source = VISION_SOURCES.find(s => s.id === frontendId)
    const category: SourceCategory = source?.category ?? 'finance'
    return {
      batchId: e.batchId,
      sourceKey: key,
      displayName: source?.name ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      logo: source?.logo,
      configHash: e.configHash,
      category,
      tickDuration: CATEGORY_TICK_DURATION[category] ?? 600,
    }
  }).sort((a, b) => a.batchId - b.batchId)
}

/** Format seconds into human-readable duration */
export function formatTickDuration(secs: number): string {
  if (secs >= 3600) return `${(secs / 3600).toFixed(0)}h`
  if (secs >= 60) return `${(secs / 60).toFixed(0)}m`
  return `${secs}s`
}
