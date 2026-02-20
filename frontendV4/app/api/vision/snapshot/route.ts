import { NextResponse } from 'next/server'

const AA_DATA_NODE = 'http://116.203.156.98/datanode'

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
    return NextResponse.json(
      { error: String(err) },
      { status: 502 },
    )
  }
}
