// Bidirectional mapping between data-node internal source IDs and display source IDs.
// Built from sources-display.json internalIds field.
// Used by API proxy routes to translate at the boundary so all frontend components
// work exclusively with display IDs.

import sourcesDisplay from '@/data/sources-display.json'

const _internalToDisplay: Record<string, string> = {}
const _displayToInternals: Record<string, string[]> = {}
const _displayToBatchKey: Record<string, string> = {}

for (const source of (sourcesDisplay as any).sources) {
  const ids: string[] = (source as any).internalIds ?? []
  if (ids.length > 0) {
    _displayToInternals[source.sourceId] = ids
  }
  for (const internalId of ids) {
    _internalToDisplay[internalId] = source.sourceId
  }
  // Curated subsources share their parent's price firehose (internalIds) but
  // run their own Vision batches, keyed by batchSubsourceKey in the oracle's
  // vision_settlements table — not by the parent internal id.
  const batchKey: string | undefined = (source as any).batchSubsourceKey
  if (batchKey) {
    _displayToBatchKey[source.sourceId] = batchKey
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

/**
 * Source ID used to key Vision *batches and settlements* on the oracle side.
 *
 * Most sources settle under their data-node internal ID. Curated subsources
 * (e.g. `defillama-ai-agents`) are the exception: they borrow the parent's
 * price firehose but run their own batch, so their settlements live under the
 * `batchSubsourceKey` in `vision_settlements`. Querying the parent ID instead
 * returns the wrong (and far larger) batch — wrong participants, slow scan.
 */
export function toBatchSourceId(displayId: string): string {
  return _displayToBatchKey[displayId] ?? toInternalId(displayId)
}
