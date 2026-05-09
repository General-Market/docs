import { NextRequest } from 'next/server'

// Server-side avatar proxy. Hits unavatar.io once, caches in-process,
// serves with strong Cache-Control so the browser + any CDN in front
// stop hammering unavatar. Solves the rate-limit (429) cliff users
// see when many handles try to resolve at once.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TTL_MS = 24 * 60 * 60 * 1000

type Cached = { buf: ArrayBuffer; ct: string; at: number }
const cache = new Map<string, Cached | 'miss'>()

const HANDLE_RE = /^[A-Za-z0-9_]{1,32}$/

async function fetchUnavatar(handle: string): Promise<Cached | null> {
  // Try strict mode first (real PFP); fall back to non-strict so we
  // always return something legible.
  const urls = [
    `https://unavatar.io/x/${encodeURIComponent(handle)}?fallback=false`,
    `https://unavatar.io/x/${encodeURIComponent(handle)}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5500),
        headers: {
          'User-Agent': 'GeneralMarket/1.0 (+https://generalmarket.io)',
        },
      })
      if (!res.ok) continue
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.startsWith('image/')) continue
      const buf = await res.arrayBuffer()
      if (buf.byteLength < 200) continue
      return { buf, ct, at: Date.now() }
    } catch {
      // try next
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('handle') ?? '')
    .trim()
    .replace(/^@+/, '')
  if (!HANDLE_RE.test(raw)) {
    return new Response(null, { status: 400 })
  }
  const handle = raw.toLowerCase()

  const hit = cache.get(handle)
  if (hit && hit !== 'miss' && Date.now() - hit.at < TTL_MS) {
    return new Response(hit.buf, {
      status: 200,
      headers: {
        'Content-Type': hit.ct,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
        'X-Avatar-Cache': 'hit',
      },
    })
  }
  if (hit === 'miss' && Date.now() - 0 < TTL_MS) {
    // Recent miss; don't re-hit upstream for a little while.
  }

  const fetched = await fetchUnavatar(handle)
  if (!fetched) {
    cache.set(handle, 'miss')
    return new Response(null, {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-Avatar-Cache': 'miss',
      },
    })
  }
  cache.set(handle, fetched)
  return new Response(fetched.buf, {
    status: 200,
    headers: {
      'Content-Type': fetched.ct,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      'X-Avatar-Cache': 'fresh',
    },
  })
}
