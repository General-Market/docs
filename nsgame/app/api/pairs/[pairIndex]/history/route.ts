// GET /api/pairs/[pairIndex]/history — server-side proxy to the data-node
// per-pair signed-score history. The chain settles on this number; the
// site-aggregate trend is the wrong shape for a head-to-head ticket.
//
// Upstream: /v1/pairs/{pairIndex}/history?minutes=N — `{ points: [{ ts, score }, ...] }`.
// On any failure (4xx, 5xx, network, missing env) we return `{ points: [] }`
// at status 200. The UI degrades to silence; a console fire is not the
// answer.
//
// Query: ?minutes=N (1..1440, default 30)

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DATA_NODE_URL = 'http://127.0.0.1:8201'
const DEFAULT_MINUTES = 30
const MIN_MINUTES = 1
const MAX_MINUTES = 1440

const PAIR_MIN = 1
const PAIR_MAX = 25

function dataNodeUrl(): string {
  return process.env.DATA_NODE_URL || DEFAULT_DATA_NODE_URL
}

function isPlausiblePairIndex(s: string): boolean {
  if (!/^\d{1,2}$/.test(s)) return false
  const n = Number(s)
  return Number.isInteger(n) && n >= PAIR_MIN && n <= PAIR_MAX
}

function clampMinutes(raw: string | null): number {
  if (!raw) return DEFAULT_MINUTES
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT_MINUTES
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n))
}

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' }

const EMPTY = { points: [] as Array<{ ts: number; score: string }> }

export async function GET(
  req: Request,
  ctx: { params: Promise<{ pairIndex: string }> },
): Promise<NextResponse> {
  const { pairIndex } = await ctx.params

  if (!isPlausiblePairIndex(pairIndex)) {
    return NextResponse.json({ error: 'bad_pair_index' }, { status: 400, headers: NO_STORE })
  }

  const url = new URL(req.url)
  const minutes = clampMinutes(url.searchParams.get('minutes'))

  const upstream = `${dataNodeUrl()}/v1/pairs/${pairIndex}/history?minutes=${minutes}`

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    })

    if (!res.ok) {
      return NextResponse.json(EMPTY, { headers: NO_STORE })
    }

    const payload = await res.json()
    if (!payload || !Array.isArray(payload.points)) {
      return NextResponse.json(EMPTY, { headers: NO_STORE })
    }
    return NextResponse.json(payload, { headers: NO_STORE })
  } catch {
    return NextResponse.json(EMPTY, { headers: NO_STORE })
  }
}
