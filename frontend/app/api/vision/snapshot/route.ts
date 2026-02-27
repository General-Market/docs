import { NextResponse } from 'next/server'

const AA_DATA_NODE = process.env.AA_DATA_NODE_URL || 'http://localhost:8200'
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
    imageUrl: null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sourceFilter = searchParams.get('source')

  try {
    // If requesting a specific source, fetch just that source from data-node
    if (sourceFilter) {
      const res = await fetch(
        `${AA_DATA_NODE}/vision/snapshot?source=${encodeURIComponent(sourceFilter)}&limit=${DETAIL_LIMIT}`,
        { next: { revalidate: 30 }, signal: AbortSignal.timeout(30_000) },
      )
      if (!res.ok) throw new Error(`AA data-node ${res.status}`)
      const raw = await res.json()
      const snapshots: Array<Record<string, unknown>> = raw.snapshots ?? []

      return NextResponse.json({
        generatedAt: raw.generatedAt,
        maxAgeSecs: null,
        totalAssets: raw.count ?? snapshots.length,
        sources: [],
        prices: snapshots.map(transformSnapshot),
      })
    }

    // Grid view: fetch first 5000 for bitmap preview (fast, ~2s)
    const res = await fetch(`${AA_DATA_NODE}/vision/snapshot?limit=5000`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`AA data-node ${res.status}`)
    const raw = await res.json()
    const snapshots: Array<Record<string, unknown>> = raw.snapshots ?? []

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

    return NextResponse.json({
      generatedAt: raw.generatedAt,
      maxAgeSecs: null,
      totalAssets: raw.count ?? snapshots.length,
      sources: [],
      prices: capped.map(transformSnapshot),
    })
  } catch (err) {
    console.error('Vision proxy error:', err)
    return NextResponse.json(
      { error: 'Upstream service unavailable' },
      { status: 502 },
    )
  }
}
