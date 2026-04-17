import { NextRequest, NextResponse } from 'next/server'

// Direct /rpc route handler — wallet extensions cache this path as the
// chain's RPC URL and send requests here (GET, POST, OPTIONS).
// Must return valid JSON-RPC for ALL methods to prevent wallets from
// receiving HTML/RSC and showing raw payload in alert dialogs.
const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || process.env.L3_RPC_URL || 'http://localhost:8545'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function proxyToL3(req: NextRequest): Promise<NextResponse> {
  try {
    const body = req.method === 'POST' ? await req.blob() : undefined
    const response = await fetch(L3_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ?? JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
      signal: AbortSignal.timeout(30_000),
    })
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: e?.message || 'RPC unreachable' }, id: null },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
    )
  }
}

export async function POST(req: NextRequest) { return proxyToL3(req) }
export async function GET(req: NextRequest) { return proxyToL3(req) }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
