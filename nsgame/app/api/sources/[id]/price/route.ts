// GET /api/sources/[id]/price — server-side proxy to the data-node tube
// observation endpoint. The data-node listens on 127.0.0.1:8201 on VPS 3;
// for local dev open an SSH tunnel:
//   ssh -N -L 8201:127.0.0.1:8201 vps3
// then set DATA_NODE_URL=http://127.0.0.1:8201 in .env.local.
//
// Failures are silent — the UI degrades to a dash, never a console fire.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DATA_NODE_URL = 'http://127.0.0.1:8201'

function dataNodeUrl(): string {
  return process.env.DATA_NODE_URL || DEFAULT_DATA_NODE_URL
}

// Source ids are small unsigned ints (1..99). Anything else is a probe.
function isPlausibleSourceId(s: string): boolean {
  if (!/^\d{1,2}$/.test(s)) return false
  const n = Number(s)
  return Number.isInteger(n) && n >= 1 && n <= 99
}

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' }

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params

  if (!isPlausibleSourceId(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400, headers: NO_STORE })
  }

  const upstream = `${dataNodeUrl()}/v1/sources/${id}/price`

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    })

    if (res.status === 503) {
      // Source exists but no observation has been recorded yet.
      return NextResponse.json({ price: null, ts: null }, { headers: NO_STORE })
    }

    if (!res.ok) {
      return NextResponse.json(
        { price: null, ts: null, error: `upstream_${res.status}` },
        { headers: NO_STORE },
      )
    }

    const payload = await res.json()
    return NextResponse.json(payload, { headers: NO_STORE })
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'fetch_failed'
    return NextResponse.json(
      { price: null, ts: null, error: msg },
      { headers: NO_STORE },
    )
  }
}
