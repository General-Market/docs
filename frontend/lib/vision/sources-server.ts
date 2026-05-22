// Server-side source registry utilities.
// Use these in server components, API routes, sitemap.ts — anywhere hooks are unavailable.
// Client components: use useSourceRegistry() from @/hooks/vision/useSourceRegistry instead.

import { getDataNodeServer } from '@/lib/config'
import sourcesDisplay from '@/data/sources-display.json'

export interface SourceDisplayServer {
  sourceId: string
  internalIds?: string[]
  /** Identifies the Vision batch that backs this source detail page. When the
   *  source is a curated subset of a parent firehose (e.g. defillama-bridges
   *  inside the DefiLlama feed), the data-node emits a dedicated batch keyed
   *  by this id. */
  batchSubsourceKey?: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
  audience?: 'human' | 'bot' | 'redirect'
  redirectTo?: string
}

export interface CategoryDisplayServer {
  key: string
  label: string
  order: number
}

export interface SourceRegistryServer {
  sources: SourceDisplayServer[]
  categories: CategoryDisplayServer[]
}

// ── Static fallback registry ───────────────────────────────────────────────────
// The committed JSON the client already trusts via @/data/sources-display.json.
// Used when the data-node upstream is unreachable (local dev, transient outage).
// Same shape as SourceDisplayServer — coerce missing string fields to empty so
// generateMetadata always produces a usable title.

const STATIC_REGISTRY: SourceRegistryServer = (() => {
  const raw = sourcesDisplay as {
    sources?: Array<Partial<SourceDisplayServer> & { sourceId: string; name?: string }>
    categories?: CategoryDisplayServer[]
  }
  const sources: SourceDisplayServer[] = (raw.sources ?? []).map(s => ({
    sourceId: s.sourceId,
    internalIds: s.internalIds,
    batchSubsourceKey: s.batchSubsourceKey,
    name: s.name ?? s.sourceId,
    description: s.description ?? '',
    category: s.category ?? '',
    logo: s.logo ?? '',
    brandBg: s.brandBg ?? '',
    prefixes: s.prefixes ?? [],
    valueLabel: s.valueLabel ?? '',
    valueUnit: s.valueUnit ?? '',
    isPrice: s.isPrice ?? false,
    audience: s.audience,
    redirectTo: s.redirectTo,
  }))
  return { sources, categories: raw.categories ?? [] }
})()

function findInRegistry(
  registry: SourceRegistryServer,
  sourceId: string,
): SourceDisplayServer | undefined {
  return registry.sources.find(
    s => s.sourceId === sourceId || s.internalIds?.includes(sourceId),
  )
}

// ── In-memory TTL cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10_000

let cached: SourceRegistryServer | null = null
let cachedAt = 0

/**
 * Fetch source registry from data-node with a 10-second in-memory TTL cache.
 * Falls back to the static JSON registry on error so callers always see a
 * non-empty list of well-known sources.
 */
export async function getSourceRegistryServer(): Promise<SourceRegistryServer> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached
  }

  try {
    const res = await fetch(`${getDataNodeServer()}/sources/registry`)
    if (!res.ok) {
      return cached ?? STATIC_REGISTRY
    }
    const data = await res.json()
    const registry: SourceRegistryServer = {
      sources: (data.sources ?? []) as SourceDisplayServer[],
      categories: (data.categories ?? []) as CategoryDisplayServer[],
    }
    cached = registry
    cachedAt = now
    return registry
  } catch {
    return cached ?? STATIC_REGISTRY
  }
}

/**
 * Get metadata for a single source by ID.
 * Tries the live registry first, then the static JSON the client already uses.
 * Returns undefined only when the ID is unknown to both.
 */
export async function getSourceDisplayServer(
  sourceId: string,
): Promise<SourceDisplayServer | undefined> {
  const registry = await getSourceRegistryServer()
  const live = findInRegistry(registry, sourceId)
  const staticEntry = findInRegistry(STATIC_REGISTRY, sourceId)
  if (live) {
    // The data-node owns functional data (prefixes, internalIds, valueLabel).
    // The static JSON owns editorial decisions (audience, redirectTo,
    // batchSubsourceKey) — overlay those on top of the live entry so routing
    // and batch lookup see the human/bot flag and the dedicated batch id.
    return {
      ...live,
      audience: staticEntry?.audience ?? live.audience,
      redirectTo: staticEntry?.redirectTo ?? live.redirectTo,
      batchSubsourceKey: staticEntry?.batchSubsourceKey ?? live.batchSubsourceKey,
    }
  }
  return staticEntry
}

/**
 * Get all known source IDs — used by sitemap generation.
 */
export async function getSourceIdsServer(): Promise<string[]> {
  const registry = await getSourceRegistryServer()
  return registry.sources.map(s => s.sourceId)
}

/**
 * Format a raw market key into a human-readable name using source prefix data.
 * Strips the matching source prefix, then replaces underscores with spaces.
 * Falls back to underscore-to-space substitution when no prefix matches.
 */
export async function formatMarketNameServer(marketKey: string): Promise<string> {
  const registry = await getSourceRegistryServer()
  for (const source of registry.sources) {
    for (const prefix of source.prefixes) {
      if (marketKey.startsWith(prefix)) {
        return marketKey.slice(prefix.length).replace(/_/g, ' ')
      }
    }
  }
  return marketKey.replace(/_/g, ' ')
}
