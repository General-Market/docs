import { NextRequest, NextResponse } from 'next/server'

// JSON-RPC proxy for L3 chain. POST-only.
// Replaces the /rpc afterFiles rewrite from next.config.ts.
const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || process.env.L3_RPC_URL || 'http://localhost:8545'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.blob()
    const response = await fetch(L3_RPC_URL, {
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
      { error: e?.message || 'RPC unreachable' },
      { status: 502 },
    )
  }
}
