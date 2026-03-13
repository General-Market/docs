import { NextRequest } from 'next/server'
import { DATA_NODE_SERVER } from '@/lib/config'

/**
 * Streaming proxy for data-node endpoints.
 * Next.js rewrites buffer entire responses, breaking SSE.
 * This route streams directly without buffering.
 *
 * GET /api/dn/sim/run-stream?... → DATA_NODE_SERVER/sim/run-stream?...
 * GET /api/dn/sim/categories → DATA_NODE_SERVER/sim/categories
 * GET /api/dn/portfolio?... → DATA_NODE_SERVER/portfolio?...
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const upstream = `${DATA_NODE_SERVER}/${path.join('/')}${request.nextUrl.search}`

  try {
    const res = await fetch(upstream, {
      headers: {
        'Accept': request.headers.get('Accept') || '*/*',
      },
      signal: AbortSignal.timeout(300_000), // 5 min timeout for long simulations
    })

    if (!res.ok) {
      return new Response(res.body, { status: res.status })
    }

    const contentType = res.headers.get('Content-Type') || 'application/json'
    const isSSE = contentType.includes('text/event-stream')

    // For SSE, stream without buffering
    if (isSSE && res.body) {
      return new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      })
    }

    // For regular JSON responses, pass through
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
