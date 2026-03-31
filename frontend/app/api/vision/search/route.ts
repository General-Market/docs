import { getAaDataNodeUrl } from '@/lib/config'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { toDisplayId, allInternalIds } from '@/lib/vision/source-ids'
import sourcesDisplay from '@/data/sources-display.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Static prefix map from sources-display.json — no network dependency for image resolution.
const PREFIXES_BY_DISPLAY: Record<string, string[]> = {}
for (const s of (sourcesDisplay as any).sources ?? []) {
  PREFIXES_BY_DISPLAY[s.sourceId] = s.prefixes ?? []
}

// Sources that have image resolvers in asset-images.ts.
// Results from these sources get boosted so they surface above faceless sources.
const SOURCES_WITH_IDENTITY = new Set([
  'coingecko', 'pumpfun', 'defillama', 'finnhub', 'nasdaq',
  'steam', 'github', 'anilist', 'polymarket', 'npm', 'queue_times',
  'reddit', 'bgg', 'twitch', 'lastfm', 'tmdb', 'sports',
  'backpacktf', 'bestbuy',
])

// High-value sources to always include in search.
const PRIORITY_SOURCES = ['coingecko', 'finnhub', 'nasdaq', 'defillama', 'polymarket', 'pumpfun']

async function fetchSource(internalId: string, limit: number): Promise<Array<Record<string, any>>> {
  try {
    const res = await fetch(
      `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(internalId)}&limit=${limit}`,
      { signal: AbortSignal.timeout(8_000) },
    )
    if (!res.ok) return []
    const raw = await res.json()
    return raw.snapshots ?? []
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
  const filter = searchParams.get('filter')

  if (!query && !filter) {
    return new Response(JSON.stringify({ error: 'Missing q or filter parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Fetch priority sources + general scan in parallel.
    // This ensures crypto, stocks, defi assets are always searchable
    // even though the general scan only covers ~10K of 300K+ assets.
    const fetches: Promise<Array<Record<string, any>>>[] = []

    for (const displayId of PRIORITY_SOURCES) {
      for (const iid of allInternalIds(displayId)) {
        fetches.push(fetchSource(iid, 5000))
      }
    }
    // General scan for everything else (no source filter)
    fetches.push((async () => {
      try {
        const res = await fetch(`${getAaDataNodeUrl()}/vision/snapshot?limit=5000`, {
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) return []
        const raw = await res.json()
        return raw.snapshots ?? []
      } catch { return [] }
    })())

    const allResults = await Promise.all(fetches)

    // Merge + deduplicate by assetId
    const seen = new Set<string>()
    const snapshots: Array<Record<string, any>> = []
    for (const batch of allResults) {
      for (const s of batch) {
        const aid = s.assetId as string
        if (!aid || seen.has(aid)) continue
        seen.add(aid)
        snapshots.push(s)
      }
    }

    const scored: Array<{ market: Record<string, any>; score: number }> = []

    for (const s of snapshots) {
      const symbol = (s.symbol || '').toLowerCase()
      const name = (s.name || '').toLowerCase()
      const assetId = (s.assetId || '').toLowerCase()
      const rawSource = (s.source || '') as string
      const source = rawSource.toLowerCase()
      const displaySource = toDisplayId(rawSource)

      let score = 0

      if (query) {
        if (symbol === query) score += 100
        else if (symbol.startsWith(query)) score += 80
        else if (name === query) score += 70
        else if (name.startsWith(query)) score += 50
        else if (symbol.includes(query)) score += 40
        else if (name.includes(query)) score += 30
        else if (assetId.includes(query)) score += 20
        else if (source.includes(query) || displaySource.toLowerCase().includes(query)) score += 10
        else continue
      }

      if (filter === 'volume' && s.volume24h) {
        score += Math.min(parseFloat(s.volume24h) / 1e9, 50)
      }
      if (filter === 'trending' && s.changePct) {
        score += Math.abs(parseFloat(s.changePct))
      }
      if (filter === 'new' && s.fetchedAt) {
        const age = Date.now() - new Date(s.fetchedAt).getTime()
        if (age < 24 * 3600 * 1000) score += 50
      }

      if (s.marketCap) {
        score += Math.min(Math.log10(parseFloat(s.marketCap) + 1), 15)
      }

      const snapshotImg = (s.imageUrl as string) ?? null
      const prefixes = PREFIXES_BY_DISPLAY[displaySource] ?? []
      const imageUrl = snapshotImg || getAssetImageUrl(displaySource, s.assetId || '', prefixes)

      // Boost sources that have visual identity — surface them above faceless entries
      if (imageUrl || SOURCES_WITH_IDENTITY.has(displaySource)) {
        score += 25
      }

      scored.push({
        market: {
          assetId: s.assetId,
          symbol: s.symbol,
          name: s.name,
          source: displaySource,
          category: s.category ?? null,
          value: s.value,
          changePct: s.changePct ?? null,
          volume24h: s.volume24h ?? null,
          marketCap: s.marketCap ?? null,
          imageUrl,
        },
        score,
      })
    }

    scored.sort((a, b) => b.score - a.score)
    const results = scored.slice(0, limit)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        for (const { market } of results) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', market })}\n\n`))
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', total: scored.length })}\n\n`)
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
