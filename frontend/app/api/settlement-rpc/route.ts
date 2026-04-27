import { NextRequest, NextResponse } from 'next/server'

// JSON-RPC proxy for the Settlement chain (Sonic testnet).
// Sonic's public RPC does not answer CORS preflight, so the browser cannot
// POST to it directly. Same-origin proxy sidesteps both CORS and any future
// mixed-content issues — mirror of /api/rpc for L3.
const SETTLEMENT_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.SETTLEMENT_RPC_URL ||
  'http://localhost:8546'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.blob()
    const response = await fetch(SETTLEMENT_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(30_000),
    })

    return new NextResponse(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Settlement RPC unreachable' },
      { status: 502 },
    )
  }
}
