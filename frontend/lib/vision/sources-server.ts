// Server-side source registry utilities.
// Use these in server components, API routes, sitemap.ts — anywhere hooks are unavailable.
// Client components: use useSourceRegistry() from @/hooks/vision/useSourceRegistry instead.

import { DATA_NODE_SERVER } from '@/lib/config'

export interface SourceDisplayServer {
  sourceId: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
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

// ── In-memory TTL cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10_000

let cached: SourceRegistryServer | null = null
let cachedAt = 0

/**
 * Fetch source registry from data-node with a 10-second in-memory TTL cache.
 * Falls back to empty registry on error — callers should handle empty gracefully.
 */
export async function getSourceRegistryServer(): Promise<SourceRegistryServer> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached
  }

  try {
    const res = await fetch(`${DATA_NODE_SERVER}/sources/registry`)
    if (!res.ok) {
      return cached ?? { sources: [], categories: [] }
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
    return cached ?? { sources: [], categories: [] }
  }
}

/**
 * Get metadata for a single source by ID.
 * Returns undefined when the source is unknown or registry unavailable.
 */
export async function getSourceDisplayServer(
  sourceId: string,
): Promise<SourceDisplayServer | undefined> {
  const registry = await getSourceRegistryServer()
  return registry.sources.find(s => s.sourceId === sourceId)
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
