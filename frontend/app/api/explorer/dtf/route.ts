import { NextRequest, NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'

const VALID_ENDPOINTS = ['fills', 'order-lifecycle', 'tvl', 'orders-per-hour'] as const
const VALID_RANGES = ['1h', '6h', '24h', '7d', '30d']
const MAX_RESPONSE_BYTES = 5_000_000
const EXPLORER_TOKEN = process.env.EXPLORER_TOKEN || ''

export async function GET(req: NextRequest) {
  if (!EXPLORER_TOKEN) {
    return NextResponse.json({ error: 'Explorer not configured' }, { status: 503 })
  }

  const { searchParams } = req.nextUrl
  const endpoint = searchParams.get('endpoint') || ''
  const range = searchParams.get('range') || '24h'

  if (!VALID_ENDPOINTS.includes(endpoint as typeof VALID_ENDPOINTS[number])) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }
  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  const url = new URL(`${getAaDataNodeUrl()}/explorer/dtf/${endpoint}`)
  url.searchParams.set('range', range)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        'x-explorer-token': EXPLORER_TOKEN,
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
    }

    const body = await res.text()
    if (body.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Response too large' }, { status: 502 })
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
  }
}
