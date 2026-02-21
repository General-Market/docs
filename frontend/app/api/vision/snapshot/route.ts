import { NextResponse } from 'next/server'

const AA_DATA_NODE = process.env.AA_DATA_NODE_URL || 'http://localhost:8200'

export async function GET() {
  try {
    const res = await fetch(`${AA_DATA_NODE}/snapshot`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) throw new Error(`AA data-node ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Vision proxy error:', err)
    return NextResponse.json(
      { error: 'Upstream service unavailable' },
      { status: 502 },
    )
  }
}
