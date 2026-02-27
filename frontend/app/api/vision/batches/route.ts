import { NextResponse } from 'next/server'

const ISSUER_URL = process.env.ISSUER_VISION_URL || 'http://localhost:10001'

export async function GET() {
  try {
    const res = await fetch(`${ISSUER_URL}/vision/batches`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Vision batches proxy error:', err)
    return NextResponse.json({ batches: [] }, { status: 502 })
  }
}
