// Bidirectional mapping between data-node internal source IDs and display source IDs.
// Built from sources-display.json internalIds field.
// Used by API proxy routes to translate at the boundary so all frontend components
// work exclusively with display IDs.

import sourcesDisplay from '@/data/sources-display.json'

const _internalToDisplay: Record<string, string> = {}
const _displayToInternal: Record<string, string> = {}

for (const source of (sourcesDisplay as any).sources) {
  const ids: string[] = (source as any).internalIds ?? []
  for (const internalId of ids) {
    _internalToDisplay[internalId] = source.sourceId
    // Only set first internal ID as the canonical reverse mapping
    if (!_displayToInternal[source.sourceId]) {
      _displayToInternal[source.sourceId] = internalId
    }
  }
}

/** Translate a data-node internal ID to the display ID used in the frontend registry. */
export function toDisplayId(internalId: string): string {
  return _internalToDisplay[internalId] ?? internalId
}

/** Translate a display ID to the data-node internal ID for API calls. */
export function toInternalId(displayId: string): string {
  return _displayToInternal[displayId] ?? displayId
}
