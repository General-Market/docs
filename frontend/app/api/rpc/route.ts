import { NextRequest, NextResponse } from 'next/server'

// JSON-RPC proxy for L3 chain. POST-only.
// Replaces the /rpc afterFiles rewrite from next.config.ts.
const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || process.env.L3_RPC_URL || 'http://localhost:8545'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 150, 400]

async function forward(body: ArrayBuffer): Promise<Response> {
  return fetch(L3_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(30_000),
  })
}

export async function POST(req: NextRequest) {
  // Read once into a Buffer so we can replay the body across retries.
  // The orbit-proxy upstream (the Nitro Go process behind nginx) flakes on
  // ~30% of concurrent batched calls — returns 502 with no body and recovers
  // on the next try. Retrying here turns those into invisible single-call
  // hiccups instead of blank vault sections in the UI.
  const body = await req.arrayBuffer()

  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]))
    }
    try {
      const response = await forward(body)
      // 5xx from upstream — orbit-proxy hiccup, worth retrying. Anything
      // else (200, 4xx) is the upstream's intended answer; pass it through.
      if (response.status >= 500 && response.status < 600 && attempt + 1 < MAX_ATTEMPTS) {
        lastResponse = response
        continue
      }
      return new NextResponse(response.body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e) {
      lastError = e
    }
  }

  if (lastResponse) {
    return new NextResponse(lastResponse.body, {
      status: lastResponse.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return NextResponse.json(
    { error: (lastError as any)?.message || 'RPC unreachable' },
    { status: 502 },
  )
}
