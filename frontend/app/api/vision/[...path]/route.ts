import { NextRequest, NextResponse } from 'next/server'
import { VISION_API_URL } from '@/lib/config'

// Catch-all proxy for Vision API paths not handled by specific route handlers.
// In App Router, specific routes (batches/, bitmap/, leaderboard/, etc.) take
// precedence — this only fires for paths with no dedicated handler.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/')
  // Vision API expects /vision/ prefix on upstream
  const url = `${VISION_API_URL}/vision/${path}${req.nextUrl.search}`

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

    if (response.headers.get('content-type')?.includes('text/event-stream')) {
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
