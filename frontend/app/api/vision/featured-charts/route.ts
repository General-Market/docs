import { NextRequest, NextResponse } from 'next/server'

// Server-side memory cache for the homepage featured chart cards.
// First visitor to a fresh container pays the data-node round-trip; everyone
// after sees what they saw — instantly. The live fetch then quietly replaces it.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CachedTopMarket = {
  assetId?: string
  symbol?: string
  name?: string
  value?: string
  changePct?: string
}

type CachedChart = {
  topMarkets: CachedTopMarket[]
  historyData: Record<string, { value: number; ts: number }[]>
  generatedAt: number
}

const ALLOWED_SOURCES = new Set(['twitch', 'db_trains', 'steam', 'earthquake'])
const MAX_AGE_MS = 60 * 60 * 1000
const MAX_TOP_MARKETS = 6
const MAX_HISTORY_POINTS = 400
const MAX_ASSET_ID_LEN = 200

declare global {
  // eslint-disable-next-line no-var
  var __gmFeaturedChartsCache: Map<string, CachedChart> | undefined
}

const cache: Map<string, CachedChart> =
  globalThis.__gmFeaturedChartsCache ??
  (globalThis.__gmFeaturedChartsCache = new Map())

export async function GET() {
  const cutoff = Date.now() - MAX_AGE_MS
  const out: Record<string, CachedChart> = {}
  for (const [id, entry] of cache) {
    if (entry.generatedAt >= cutoff) out[id] = entry
    else cache.delete(id)
  }
  return NextResponse.json(
    { sources: out },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=120',
      },
    },
  )
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { sourceId, topMarkets, historyData } = body ?? {}

  if (typeof sourceId !== 'string' || !ALLOWED_SOURCES.has(sourceId)) {
    return NextResponse.json({ error: 'Bad sourceId' }, { status: 400 })
  }
  if (!Array.isArray(topMarkets) || topMarkets.length === 0) {
    return NextResponse.json({ error: 'Bad topMarkets' }, { status: 400 })
  }
  if (!historyData || typeof historyData !== 'object') {
    return NextResponse.json({ error: 'Bad historyData' }, { status: 400 })
  }

  const cleanTopMarkets: CachedTopMarket[] = topMarkets
    .slice(0, MAX_TOP_MARKETS)
    .map((m: any) => ({
      assetId: typeof m?.assetId === 'string' ? m.assetId.slice(0, MAX_ASSET_ID_LEN) : undefined,
      symbol: typeof m?.symbol === 'string' ? m.symbol.slice(0, MAX_ASSET_ID_LEN) : undefined,
      name: typeof m?.name === 'string' ? m.name.slice(0, 200) : undefined,
      value: typeof m?.value === 'string' ? m.value.slice(0, 64) : undefined,
      changePct: typeof m?.changePct === 'string' ? m.changePct.slice(0, 16) : undefined,
    }))
    .filter((m) => m.assetId || m.symbol)

  if (cleanTopMarkets.length === 0) {
    return NextResponse.json({ error: 'Empty topMarkets' }, { status: 400 })
  }

  const cleanHistory: Record<string, { value: number; ts: number }[]> = {}
  for (const [k, v] of Object.entries(historyData)) {
    if (typeof k !== 'string' || k.length === 0 || k.length > MAX_ASSET_ID_LEN) continue
    if (!Array.isArray(v)) continue
    const points: { value: number; ts: number }[] = []
    for (const p of (v as any[]).slice(0, MAX_HISTORY_POINTS)) {
      const value = typeof p?.value === 'number' ? p.value : NaN
      const ts = typeof p?.ts === 'number' ? p.ts : NaN
      if (!Number.isFinite(value) || !Number.isFinite(ts)) continue
      points.push({ value, ts })
    }
    if (points.length >= 2) cleanHistory[k] = points
  }

  if (Object.keys(cleanHistory).length === 0) {
    return NextResponse.json({ error: 'No valid history' }, { status: 400 })
  }

  cache.set(sourceId, {
    topMarkets: cleanTopMarkets,
    historyData: cleanHistory,
    generatedAt: Date.now(),
  })

  return NextResponse.json({ ok: true, sourceId })
}
