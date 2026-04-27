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
])

export function isHiddenSourceId(id: unknown): boolean {
  return typeof id === 'string' && HIDDEN_SOURCE_IDS.has(id)
}

export function isHiddenSource(s: { sourceId?: unknown; internalIds?: unknown }): boolean {
  if (typeof s.sourceId === 'string' && HIDDEN_SOURCE_IDS.has(s.sourceId)) return true
  if (Array.isArray(s.internalIds) && s.internalIds.some(isHiddenSourceId)) return true
  return false
}
