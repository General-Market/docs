import { NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const qs = searchParams.toString()
  try {
    const res = await fetch(
      `${getAaDataNodeUrl()}/oracle/balances${qs ? `?${qs}` : ''}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) {
      return NextResponse.json(
        { series: [], roster: [], error: `upstream ${res.status}` },
        { status: res.status },
      )
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    })
  } catch (e) {
    return NextResponse.json(
      { series: [], roster: [], error: (e as Error).message },
      { status: 502 },
    )
  }
}
