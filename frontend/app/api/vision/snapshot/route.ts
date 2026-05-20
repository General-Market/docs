import { NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'
import { allInternalIds } from '@/lib/vision/source-ids'
import { isHiddenSourceId } from '@/lib/vision/hidden-sources'
import sourcesDisplay from '@/data/sources-display.json'
import { getDefiLlamaAllowlist } from '@/lib/vision/defillama-curated'

type DisplaySource = {
  sourceId: string
  internalIds?: string[]
  prefixes?: string[]
  audience?: 'human' | 'bot' | 'redirect'
  redirectTo?: string
}

const DISPLAY_BY_ID: Record<string, DisplaySource> = (() => {
  const map: Record<string, DisplaySource> = {}
  for (const s of (sourcesDisplay as { sources: DisplaySource[] }).sources) {
    map[s.sourceId] = s
  }
  return map
})()
const DETAIL_LIMIT = 10_000   // Per-source detail page (crypto=10K, defi=6K)
const GRID_CAP_PER_SOURCE = 200  // Grid view bitmap preview cap

function transformSnapshot(s: Record<string, unknown>) {
  return {
    source: s.source,
    assetId: s.assetId,
    symbol: s.symbol,
    name: s.name,
    category: s.category ?? null,
    value: s.value,
    prevClose: null,
    changePct: s.changePct ?? null,
    volume24h: s.volume24h ?? null,
    marketCap: s.marketCap ?? null,
    fetchedAt: s.fetchedAt,
    imageUrl: (s.imageUrl as string) ?? null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sourceFilter = searchParams.get('source')

  try {
    // If requesting a specific source, fetch just that source from data-node
    if (sourceFilter) {
      // Hidden sources are unreachable via the snapshot endpoint too, so any
      // listing widget that asks "what's in source X" gets nothing back.
      if (isHiddenSourceId(sourceFilter)) {
        const empty = NextResponse.json({
          generatedAt: new Date().toISOString(),
          maxAgeSecs: null,
          totalAssets: 0,
          sources: [],
          prices: [],
        })
        empty.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
        return empty
      }
      // Try all internal IDs in parallel (e.g., coingecko → ["defi", "crypto"]) — keep largest
      const results = await Promise.all(
        allInternalIds(sourceFilter).map(async (internalId) => {
          try {
            const res = await fetch(
              `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(internalId)}&limit=${DETAIL_LIMIT}`,
              { next: { revalidate: 30 }, signal: AbortSignal.timeout(30_000) },
            )
            if (!res.ok) return []
            const raw = await res.json()
            return (raw.snapshots ?? []) as Array<Record<string, unknown>>
          } catch { return [] }
        })
      )
      let snapshots = results.reduce((best, curr) => curr.length > best.length ? curr : best, [] as Array<Record<string, unknown>>)

      // Audience-aware filtering: human pages get a curated slice of the
      // upstream firehose. Bot pages get the full prefix range. Redirect
      // entries shouldn't be reachable here at all — the page-level
      // redirect handles them — but defend against the edge case anyway.
      //
      // TODO: once data-node /vision/snapshot exposes `tradable_in_ui`
      // and accepts `tradable_only=true`, filter upstream and delete this
      // client-side intersection (along with data/defillama-curated.json).
      const display = DISPLAY_BY_ID[sourceFilter]
      if (display) {
        const prefixes = display.prefixes ?? []
        if (prefixes.length > 0) {
          snapshots = snapshots.filter(s => {
            const id = typeof s.assetId === 'string' ? s.assetId : ''
            return prefixes.some(p => id.startsWith(p))
          })
        }
        if (display.audience === 'human') {
          const allow = getDefiLlamaAllowlist(sourceFilter)
          if (allow) {
            snapshots = snapshots.filter(s => {
              const id = typeof s.assetId === 'string' ? s.assetId : ''
              return allow.has(id)
            })
          }
        }
      }

      const response = NextResponse.json({
        generatedAt: new Date().toISOString(),
        maxAgeSecs: null,
        totalAssets: snapshots.length,
        sources: [],
        prices: snapshots.map(transformSnapshot),
      })
      response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
      return response
    }

    // Grid view: fetch first 5000 for bitmap preview (fast, ~2s)
    const res = await fetch(`${getAaDataNodeUrl()}/vision/snapshot?limit=5000`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`AA data-node ${res.status}`)
    const raw = await res.json()
    const snapshots: Array<Record<string, unknown>> = (raw.snapshots ?? [])
      .filter((s: Record<string, unknown>) => !isHiddenSourceId(s.source))

    // Cap per source so one large source doesn't crowd out the rest
    const countBySource: Record<string, number> = {}
    const capped: Array<Record<string, unknown>> = []
    for (const s of snapshots) {
      const src = s.source as string
      countBySource[src] = (countBySource[src] ?? 0) + 1
      if (countBySource[src] <= GRID_CAP_PER_SOURCE) {
        capped.push(s)
      }
    }

    const response = NextResponse.json({
      generatedAt: raw.generatedAt,
      maxAgeSecs: null,
      totalAssets: raw.count ?? snapshots.length,
      sources: [],
      prices: capped.map(transformSnapshot),
    })
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    console.error('Vision proxy error:', err)
    return NextResponse.json(
      { error: 'Upstream service unavailable' },
      { status: 502 },
    )
  }
}
