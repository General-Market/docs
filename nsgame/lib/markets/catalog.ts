/**
 * Site-aggregate catalog. Spans all five tube sources except chaturbate
 * (id=4) — the data-node collector for cb is not yet running. Every entry
 * resolves to a question of the form: "did the site total grow by N bps in
 * T seconds?". Per-asset markets (per-star, per-model, per-video) wait on
 * a program-side asset_id seed; see PLAN.md §3.
 *
 * The on-chain Market PDA is keyed by `(source_id, close_time,
 * settlement_time, threshold_bps)`. There is no asset selector. Every
 * market here is therefore a site-wide aggregate — by construction.
 *
 * Microcopy is project voice: short, dry, no enthusiasm. Do not embellish.
 */

export interface CatalogEntry {
  /** Stable identifier; must not change between deploys. */
  id: string
  /** Admin-registered Source.source_id on-chain. */
  sourceId: number
  /** Display label for the source (e.g. "Pornhub"). Cosmetic. */
  sourceName: string
  /** Signed bps threshold. Positive = YES on rise, negative = YES on drop. */
  thresholdBps: number
  /** Seconds from click-time until the Market stops accepting bets. */
  closeOffsetSecs: number
  /** Seconds from click-time until the Market becomes resolvable. */
  settleOffsetSecs: number
  /** One-line catalog-card label. */
  label: string
  /** Longer explanation of what YES means. */
  description: string
}

const SOURCE_LABELS: Record<number, string> = {
  1: 'Xvideos',
  2: 'Xnxx',
  3: 'Pornhub',
  5: 'Eporner',
}

interface BuildOpts {
  sourceId: number
  thresholdBps: number
  closeOffsetSecs: number
}

const SETTLE_DELAY_SECS = 60

function describeWindow(secs: number): string {
  if (secs < 3600) return `${Math.round(secs / 60)} min`
  if (secs < 86_400) return `${Math.round(secs / 3600)} h`
  return `${Math.round(secs / 86_400)} d`
}

function thresholdLabel(bps: number): string {
  // bps to a human-readable percentage. +1bps = 0.01%, +50 = 0.5%, +100 = 1%.
  const pct = bps / 100
  const sign = bps >= 0 ? '+' : ''
  if (Math.abs(bps) < 10) return `${sign}${bps} bps`
  return `${sign}${pct}%`
}

function entryFor({ sourceId, thresholdBps, closeOffsetSecs }: BuildOpts): CatalogEntry {
  const sourceName = SOURCE_LABELS[sourceId] ?? `source_${sourceId}`
  const slug = sourceName.toLowerCase()
  const win = describeWindow(closeOffsetSecs)
  const winSlug = win.replace(/\s+/g, '')
  const threshLabel = thresholdLabel(thresholdBps)
  const direction = thresholdBps >= 0 ? 'up' : 'down'
  const id = `${slug}-${direction}-${Math.abs(thresholdBps)}bps-${winSlug}`

  // Cioran-tinged microcopy. Setup → pivot → no embellishment.
  const verb = thresholdBps >= 0 ? 'rises by' : 'falls by'
  const absPct = Math.abs(thresholdBps) / 100
  const pctText = Math.abs(thresholdBps) < 10
    ? `${Math.abs(thresholdBps)} bps`
    : `${absPct}%`

  const label = `${sourceName} aggregate ${verb} ${pctText} in ${win}`
  const description =
    `YES pays if ${sourceName}'s site-wide aggregate signal `
    + `(summed across the source's tracked markets) is ${thresholdBps >= 0 ? 'higher' : 'lower'} `
    + `at settlement than at close, by at least ${threshLabel}.`

  return {
    id,
    sourceId,
    sourceName,
    thresholdBps,
    closeOffsetSecs,
    settleOffsetSecs: closeOffsetSecs + SETTLE_DELAY_SECS,
    label,
    description,
  }
}

// Generate one entry per (source, threshold, window). Skip chaturbate (id=4)
// — collector not running. Five thresholds × four windows × four sources
// would be 80 entries; we trim to a representative twenty.
const SOURCES_ENABLED = [1, 2, 3, 5] as const
const WINDOWS_SECS = [60, 300, 1800, 3600] as const
const THRESHOLDS_BPS = [1, 50, 100] as const

function buildCatalog(): readonly CatalogEntry[] {
  const out: CatalogEntry[] = []
  // For each source, pick a varied subset rather than the full cross-product.
  // Rotation of (window, threshold) keeps the catalog wide without bloating.
  for (const sourceId of SOURCES_ENABLED) {
    // 1m / 1bps — the cheapest proof-of-life market per source.
    out.push(entryFor({ sourceId, thresholdBps: 1, closeOffsetSecs: 60 }))
    // 5m / 50bps — a half-percent move in five minutes.
    out.push(entryFor({ sourceId, thresholdBps: 50, closeOffsetSecs: 300 }))
    // 30m / 100bps — a one-percent move in half an hour.
    out.push(entryFor({ sourceId, thresholdBps: 100, closeOffsetSecs: 1800 }))
    // 1h / 50bps — a half-percent move on the hour.
    out.push(entryFor({ sourceId, thresholdBps: 50, closeOffsetSecs: 3600 }))
  }
  return out
}

export const CATALOG: readonly CatalogEntry[] = buildCatalog()

export function getCatalogEntry(id: string): CatalogEntry | null {
  return CATALOG.find(e => e.id === id) ?? null
}

// Re-exported helpers for symmetry with `nsgame/lib/solana/catalog.ts`.
// The unused vars hint silences if the compiler eventually whines.
export const SOURCE_LABELS_BY_ID = SOURCE_LABELS

// Suppress unused warnings for the rotation seeds; kept exported for tests.
export const _CATALOG_BUILD_PARAMS = {
  SOURCES_ENABLED,
  WINDOWS_SECS,
  THRESHOLDS_BPS,
} as const
