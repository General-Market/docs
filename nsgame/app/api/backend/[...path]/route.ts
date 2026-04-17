import { NextRequest, NextResponse } from 'next/server'

// Catch-all proxy for the backend (oracle/issuer backend on port 3001).
// Replaces all 14 BACKEND_URL afterFiles rewrites from next.config.ts:
//   /api/leaderboard, /api/bets/*, /api/agents/*, /api/resolutions/*,
//   /api/telegram/*, /api/sse/*, /api/keepers/*, /api/markets/*,
//   /api/market-prices, /api/market-stats/*, /api/categories,
//   /api/snapshots/*, /health
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/')
  const url = `${BACKEND_URL}/${path}${req.nextUrl.search}`

  const headers = new Headers()
  for (const [key, value] of req.headers.entries()) {
    if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
      signal: AbortSignal.timeout(300_000),
    })

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('transfer-encoding')

    // Support SSE streaming (used by /api/sse/* endpoints)
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream')) {
      responseHeaders.set('X-Accel-Buffering', 'no')
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      responseHeaders.set('Connection', 'keep-alive')
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Upstream unreachable' },
      { status: 502 },
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxyRequest(req, path)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxyRequest(req, path)
}
