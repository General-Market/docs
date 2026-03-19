// Bidirectional mapping between data-node internal source IDs and display source IDs.
// Built from sources-display.json internalIds field.
// Used by API proxy routes to translate at the boundary so all frontend components
// work exclusively with display IDs.

import sourcesDisplay from '@/data/sources-display.json'

const _internalToDisplay: Record<string, string> = {}
const _displayToInternals: Record<string, string[]> = {}

for (const source of (sourcesDisplay as any).sources) {
  const ids: string[] = (source as any).internalIds ?? []
  if (ids.length > 0) {
    _displayToInternals[source.sourceId] = ids
  }
  for (const internalId of ids) {
    _internalToDisplay[internalId] = source.sourceId
  }
}

/** Translate a data-node internal ID to the display ID used in the frontend registry. */
export function toDisplayId(internalId: string): string {
  return _internalToDisplay[internalId] ?? internalId
}

/** Translate a display ID to the first data-node internal ID for API calls. */
export function toInternalId(displayId: string): string {
  return _displayToInternals[displayId]?.[0] ?? displayId
}

/** Get ALL internal IDs for a display ID (for trying multiple endpoints). */
export function allInternalIds(displayId: string): string[] {
  return _displayToInternals[displayId] ?? [displayId]
}
