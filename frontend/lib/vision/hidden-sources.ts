/**
 * Frontend-only blocklist for source IDs that should never surface in any
 * UI listing (homepage grid, category nav, side b-roll cards, snapshot
 * meta consumers, etc.). The source still exists in the data-node, on
 * chain, and via deep link — it just isn't browsable from the UI.
 *
 * Each entry hides both the displayId and any internalIds, so a rename
 * doesn't quietly re-expose a source.
 */
export const HIDDEN_SOURCE_IDS = new Set<string>([
  'tubes',
  'chaturbate',
  // Bucket A — feed dead, no recovery path
  'pypi',
  'weather',
  'tomtom_evcharge',
  'tomtom_traffic',
  'npm',
  // Bucket B — data-node DISABLED_SOURCES (legacy batches still resolve
  // via deep link; UI listings stop pretending these are live)
  'bestbuy',
  'flights',
  // CoinGecko rate-limited the feed — every crypto batch was refunding.
  // Disabled in the data-node DISABLED_SOURCES and hidden here; the detail
  // page 404s (no vault, no human audience). Re-list when the feed is live.
  'coingecko',
  'crypto',
  // Bucket C — registry empty / not started
  'aisstream',
  'bgg',
  'cbp_border',
  'cftc',
  'courtlistener',
  'ebird',
  'futures',
  'imf',
  'ioda',
  'maritime',
  'movebank',
  'finra',
  'nrc_nuclear',
  'opec',
  'openmeteo',
  'paris_metro',
  'reddit',
  'shelter',
  'stackexchange',
  // Bucket D outliers — feed fresh, vault never joins
  'yahoo_drinks',
  'usa_spending',
])

export function isHiddenSourceId(id: unknown): boolean {
  return typeof id === 'string' && HIDDEN_SOURCE_IDS.has(id)
}

export function isHiddenSource(s: { sourceId?: unknown; internalIds?: unknown }): boolean {
  if (typeof s.sourceId === 'string' && HIDDEN_SOURCE_IDS.has(s.sourceId)) return true
  if (Array.isArray(s.internalIds) && s.internalIds.some(isHiddenSourceId)) return true
  return false
}
