import { getAaDataNodeUrl } from '@/lib/config'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { toDisplayId, allInternalIds } from '@/lib/vision/source-ids'
import sourcesDisplay from '@/data/sources-display.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Static prefix map from sources-display.json
const PREFIXES_BY_DISPLAY: Record<string, string[]> = {}
for (const s of (sourcesDisplay as any).sources ?? []) {
  PREFIXES_BY_DISPLAY[s.sourceId] = s.prefixes ?? []
}

const SOURCES_WITH_IDENTITY = new Set([
  'coingecko', 'pumpfun', 'defillama', 'finnhub', 'nasdaq',
  'steam', 'github', 'anilist', 'polymarket', 'npm', 'queue_times',
  'reddit', 'bgg', 'twitch', 'lastfm', 'tmdb', 'sports',
  'backpacktf', 'bestbuy',
])

const PRIORITY_SOURCES = ['coingecko', 'finnhub', 'nasdaq', 'defillama', 'polymarket', 'pumpfun']

// ── In-Memory Search Index ──────────────────────────────
// Built once, refreshed every 2 minutes. Turns O(n) per-query fetches into O(1) lookups.

interface IndexEntry {
  assetId: string
  symbol: string
  name: string
  source: string        // display source ID
  category: string | null
  value: string
  changePct: string | null
  volume24h: string | null
  marketCap: string | null
  imageUrl: string | null
  // Pre-lowercased for search
  _sym: string
  _name: string
  _aid: string
  _src: string
  // Pre-computed base score (market cap bonus + identity bonus)
  _baseScore: number
}

interface SearchIndex {
  entries: IndexEntry[]
  // Precomputed top-12 results for every 1-2 letter prefix
  prefixCache: Map<string, IndexEntry[]>
  builtAt: number
}

let searchIndex: SearchIndex | null = null
let indexBuildPromise: Promise<SearchIndex> | null = null
const INDEX_TTL = 120_000 // 2 minutes

function resolveImage(displaySource: string, assetId: string, snapshotImg: string | null): string | null {
  if (snapshotImg) return snapshotImg
  const prefixes = PREFIXES_BY_DISPLAY[displaySource] ?? []
  return getAssetImageUrl(displaySource, assetId, prefixes)
}

async function fetchSource(internalId: string, limit: number): Promise<Array<Record<string, any>>> {
  try {
    const res = await fetch(
      `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(internalId)}&limit=${limit}`,
      { next: { revalidate: 120 }, signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) return []
    const raw = await res.json()
    return raw.snapshots ?? []
  } catch {
    return []
  }
}

async function buildIndex(): Promise<SearchIndex> {
  const fetches: Promise<Array<Record<string, any>>>[] = []

  // Fetch all priority sources
  for (const displayId of PRIORITY_SOURCES) {
    for (const iid of allInternalIds(displayId)) {
      fetches.push(fetchSource(iid, 10_000))
    }
  }
  // General scan
  fetches.push(fetchSource('', 10_000)) // no source filter = all

  const allResults = await Promise.all(fetches)

  // Merge + deduplicate
  const seen = new Set<string>()
  const entries: IndexEntry[] = []

  for (const batch of allResults) {
    for (const s of batch) {
      const aid = s.assetId as string
      if (!aid || seen.has(aid)) continue
      seen.add(aid)

      const rawSource = (s.source || '') as string
      const displaySource = toDisplayId(rawSource)
      const imageUrl = resolveImage(displaySource, aid, (s.imageUrl as string) ?? null)

      let baseScore = 0
      if (s.marketCap) baseScore += Math.min(Math.log10(parseFloat(s.marketCap) + 1), 15)
      if (imageUrl || SOURCES_WITH_IDENTITY.has(displaySource)) baseScore += 25

      entries.push({
        assetId: aid,
        symbol: s.symbol || '',
        name: s.name || '',
        source: displaySource,
        category: s.category ?? null,
        value: s.value || '0',
        changePct: s.changePct ?? null,
        volume24h: s.volume24h ?? null,
        marketCap: s.marketCap ?? null,
        imageUrl,
        _sym: (s.symbol || '').toLowerCase(),
        _name: (s.name || '').toLowerCase(),
        _aid: aid.toLowerCase(),
        _src: displaySource.toLowerCase(),
        _baseScore: baseScore,
      })
    }
  }

  // Build prefix cache for 1-2 letter combos
  const prefixCache = new Map<string, IndexEntry[]>()
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'

  for (const c1 of alphabet) {
    buildPrefixResults(c1, entries, prefixCache)
    for (const c2 of alphabet) {
      buildPrefixResults(c1 + c2, entries, prefixCache)
    }
  }

  return { entries, prefixCache, builtAt: Date.now() }
}

function buildPrefixResults(prefix: string, entries: IndexEntry[], cache: Map<string, IndexEntry[]>) {
  const scored: { entry: IndexEntry; score: number }[] = []

  for (const e of entries) {
    let score = e._baseScore

    if (e._sym === prefix) score += 100
    else if (e._sym.startsWith(prefix)) score += 80
    else if (e._name === prefix) score += 70
    else if (e._name.startsWith(prefix)) score += 50
    else if (e._sym.includes(prefix)) score += 40
    else if (e._name.includes(prefix)) score += 30
    else if (e._aid.includes(prefix)) score += 20
    else if (e._src.includes(prefix)) score += 10
    else continue

    scored.push({ entry: e, score })
  }

  scored.sort((a, b) => b.score - a.score)
  cache.set(prefix, scored.slice(0, 12).map(s => s.entry))
}

async function getIndex(): Promise<SearchIndex> {
  if (searchIndex && Date.now() - searchIndex.builtAt < INDEX_TTL) {
    return searchIndex
  }

  // Deduplicate concurrent builds
  if (!indexBuildPromise) {
    indexBuildPromise = buildIndex().then(idx => {
      searchIndex = idx
      indexBuildPromise = null
      return idx
    }).catch(err => {
      indexBuildPromise = null
      throw err
    })
  }

  // If stale index exists, return it while rebuild runs in background
  if (searchIndex) {
    indexBuildPromise.catch(() => {}) // swallow background errors
    return searchIndex
  }

  return indexBuildPromise
}

function searchEntries(query: string, index: SearchIndex, limit: number): { results: IndexEntry[]; total: number } {
  // Check prefix cache first (instant for 1-2 letter queries)
  const cached = index.prefixCache.get(query)
  if (cached) {
    return { results: cached.slice(0, limit), total: cached.length }
  }

  // Full scan for longer queries
  const scored: { entry: IndexEntry; score: number }[] = []

  for (const e of index.entries) {
    let score = e._baseScore

    if (e._sym === query) score += 100
    else if (e._sym.startsWith(query)) score += 80
    else if (e._name === query) score += 70
    else if (e._name.startsWith(query)) score += 50
    else if (e._sym.includes(query)) score += 40
    else if (e._name.includes(query)) score += 30
    else if (e._aid.includes(query)) score += 20
    else if (e._src.includes(query)) score += 10
    else continue

    scored.push({ entry: e, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return { results: scored.slice(0, limit).map(s => s.entry), total: scored.length }
}

// Eagerly start building the index when this module is first loaded.
// On Vercel Fluid Compute, the function instance persists — so the index
// is ready before the first user types anything.
getIndex().catch(() => {})

// ── Route Handler ───────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50)

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const wantsJson = request.headers.get('Accept')?.includes('application/json')

  try {
    const index = await getIndex()
    const { results, total } = searchEntries(query, index, limit)

    const markets = results.map(entry => ({
      assetId: entry.assetId,
      symbol: entry.symbol,
      name: entry.name,
      source: entry.source,
      category: entry.category,
      value: entry.value,
      changePct: entry.changePct,
      volume24h: entry.volume24h,
      marketCap: entry.marketCap,
      imageUrl: entry.imageUrl,
    }))

    // Fast path: JSON response (no SSE overhead). Used by updated client hook.
    if (wantsJson) {
      return new Response(JSON.stringify({ results: markets, total }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
        },
      })
    }

    // Legacy SSE path — kept for backwards compatibility
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        for (const market of markets) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', market })}\n\n`))
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', total })}\n\n`)
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
