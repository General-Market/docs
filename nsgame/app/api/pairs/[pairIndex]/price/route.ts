// GET /api/pairs/[pairIndex]/price — server-side proxy to the data-node
// per-pair live signed-score endpoint. This is the number the chain
// settles on: F1 → Δ_A − Δ_B, F2 → value_A − value_B.
//
// Upstream: /v1/pairs/{pairIndex}/price → `{ score, deltaA, deltaB,
// valueA, valueB, missing: [...], ts }`. On failure we return
// `{ score: null, missing: ['a','b'] }` so the UI shows a dash.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DATA_NODE_URL = 'http://127.0.0.1:8201'

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

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' }

const FAILURE = { score: null, missing: ['a', 'b'] as Array<'a' | 'b'> }

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pairIndex: string }> },
): Promise<NextResponse> {
  const { pairIndex } = await ctx.params

  if (!isPlausiblePairIndex(pairIndex)) {
    return NextResponse.json({ error: 'bad_pair_index' }, { status: 400, headers: NO_STORE })
  }

  const upstream = `${dataNodeUrl()}/v1/pairs/${pairIndex}/price`

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    })

    if (res.status === 503) {
      // Pair exists but no observations yet on either side.
      return NextResponse.json(FAILURE, { headers: NO_STORE })
    }

    if (!res.ok) {
      return NextResponse.json(FAILURE, { headers: NO_STORE })
    }

    const payload = await res.json()
    return NextResponse.json(payload, { headers: NO_STORE })
  } catch {
    return NextResponse.json(FAILURE, { headers: NO_STORE })
  }
}
