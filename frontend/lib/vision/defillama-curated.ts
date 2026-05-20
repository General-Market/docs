// Mirrors data-node/src/config/dl-curated.json — the editorial decision
// about which protocols/chains belong on each human DefiLlama page.
// Keys are display source IDs (e.g. "defillama-derivatives"), values are
// the fully-qualified asset IDs the snapshot endpoint returns (slugs are
// prefixed with `protocol_` unless they already start with `chain_`).
//
// Kept in sync by hand for now. The eventual fix is letting the data-node
// expose `tradable_in_ui`/`ui_rank` on the snapshot payload — at that
// point this file is deleted and the proxy filters on metadata instead.

import curatedRaw from '@/data/defillama-curated.json'

const _raw = curatedRaw as Record<string, string[]>

function toAssetId(slug: string): string {
  return slug.startsWith('chain_') ? slug : `protocol_${slug}`
}

const _allowlist: Record<string, Set<string>> = {}
for (const [displayId, slugs] of Object.entries(_raw)) {
  _allowlist[displayId] = new Set(slugs.map(toAssetId))
}

/** Returns the curated asset-ID allowlist for a display source, or null
 *  when no allowlist applies (firehose pages, non-defillama sources, or
 *  pages whose curation has not been populated yet). */
export function getDefiLlamaAllowlist(displayId: string): Set<string> | null {
  return _allowlist[displayId] ?? null
}

/** Returns the ordered slug list as it appears in the curated JSON.
 *  Useful when a caller wants to sort by editorial rank. */
export function getDefiLlamaOrderedSlugs(displayId: string): string[] {
  return _raw[displayId] ?? []
}
