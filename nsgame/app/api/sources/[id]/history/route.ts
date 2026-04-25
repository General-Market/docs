// GET /api/sources/[id]/history — server-side proxy for the data-node tube
// observation history. The data-node may or may not implement
// `/v1/sources/{id}/history?minutes=N` yet; the route degrades to an empty
// array on 404, network failure, or unset env. Silence beats a console fire.
//
// Query: ?minutes=N (1..1440, default 30)

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DATA_NODE_URL = 'http://127.0.0.1:8201'
const DEFAULT_MINUTES = 30
const MIN_MINUTES = 1
const MAX_MINUTES = 1440

function dataNodeUrl(): string {
  return process.env.DATA_NODE_URL || DEFAULT_DATA_NODE_URL
}

function isPlausibleSourceId(s: string): boolean {
  if (!/^\d{1,2}$/.test(s)) return false
  const n = Number(s)
  return Number.isInteger(n) && n >= 1 && n <= 99
}

function clampMinutes(raw: string | null): number {
  if (!raw) return DEFAULT_MINUTES
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT_MINUTES
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n))
}

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' }

const EMPTY = { points: [] as Array<{ ts: number; raw: string }> }

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params

  if (!isPlausibleSourceId(id)) {
    return NextResponse.json(EMPTY, { headers: NO_STORE })
  }

  const url = new URL(req.url)
  const minutes = clampMinutes(url.searchParams.get('minutes'))

  const upstream = `${dataNodeUrl()}/v1/sources/${id}/history?minutes=${minutes}`

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    })

    if (!res.ok) {
      return NextResponse.json(EMPTY, { headers: NO_STORE })
    }

    const payload = await res.json()
    // Pass through whatever shape the upstream emits, but defend against
    // a missing `points` field.
    if (!payload || !Array.isArray(payload.points)) {
      return NextResponse.json(EMPTY, { headers: NO_STORE })
    }
    return NextResponse.json(payload, { headers: NO_STORE })
  } catch {
    return NextResponse.json(EMPTY, { headers: NO_STORE })
  }
}
