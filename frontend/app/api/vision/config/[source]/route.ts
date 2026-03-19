import { NextResponse } from 'next/server'
import { DATA_NODE_SERVER } from '@/lib/config'

// Frontend display sourceId → data-node batch_configs source_id
const SOURCE_ALIASES: Record<string, string[]> = {
  coingecko: ['crypto'],
  defillama: ['defi'],
  finnhub: ['stocks'],
  fred: ['rates'],
  nasdaq: ['stocks'],
  futures: ['stocks'],
  finra: ['finra_short_vol'],
}

async function tryFetch(source: string): Promise<Response | null> {
  try {
    const res = await fetch(
      `${DATA_NODE_SERVER}/batches/source/${encodeURIComponent(source)}/config`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) return res
  } catch {}
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  if (!source || source.length > 64) {
    return NextResponse.json({ markets: [] }, { status: 400 })
  }
  // Try exact name first, then aliases
  const candidates = [source, ...(SOURCE_ALIASES[source] ?? [])]
  for (const name of candidates) {
    const res = await tryFetch(name)
    if (res) {
      const data = await res.json()
      if ((data.markets ?? []).length > 0) {
        const response = NextResponse.json(data)
        response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return response
      }
    }
  }
  return NextResponse.json({ markets: [] })
}
