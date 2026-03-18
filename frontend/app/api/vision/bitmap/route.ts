import { NextRequest, NextResponse } from 'next/server'
import { VISION_ISSUER_URLS } from '@/lib/config'

const ISSUER_URLS = VISION_ISSUER_URLS

/**
 * Fan-out bitmap submission to all issuer nodes.
 * The browser POSTs here (same-origin, no CORS), and we forward to each issuer server-side.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()

  const results = await Promise.all(
    ISSUER_URLS.map(async (url) => {
      try {
        const res = await fetch(`${url}/vision/bitmap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        const text = await res.text()
        return { url, status: res.status, ok: res.ok, body: text }
      } catch (e) {
        return { url, status: 0, ok: false, body: (e as Error).message }
      }
    })
  )

  const accepted = results.filter(r => r.ok).length
  return NextResponse.json({
    acceptedCount: accepted,
    totalCount: results.length,
    results: results.map(r => ({
      url: r.url,
      accepted: r.ok,
      error: r.ok ? undefined : `HTTP ${r.status}: ${r.body.slice(0, 200)}`,
    })),
  })
}
