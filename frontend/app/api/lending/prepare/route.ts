import { NextRequest, NextResponse } from 'next/server'
import { getCuratorServer, getCuratorApiKey } from '@/lib/config'

// Proxy POST /api/lending/prepare to the curator's allocator-backed endpoint.
// The curator binds to localhost on its host VPS; this route is the only path
// browser-side wallets have into it. Reallocate transactions can take up to
// ~90s, so the upstream timeout matches what the curator promises.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const upstream = `${getCuratorServer().replace(/\/$/, '')}/api/lending/prepare`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = getCuratorApiKey()
  if (apiKey) headers['x-api-key'] = apiKey

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(95_000),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isTimeout = message.includes('timeout') || message.includes('aborted')
    return NextResponse.json(
      { error: isTimeout ? 'Curator did not respond in time' : `Curator unreachable: ${message}`,
        code: isTimeout ? 'PREPARE_TIMEOUT' : 'CURATOR_UNREACHABLE' },
      { status: isTimeout ? 504 : 502 }
    )
  }
}
