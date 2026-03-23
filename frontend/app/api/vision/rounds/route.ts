import { keccak256, toHex } from 'viem'
import { getIssuerVisionUrl } from '@/lib/config'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceFilter = searchParams.get('source')

    // Oracle endpoint is /vision/rounds/active (not /vision/rounds which 404s)
    // Source filter doesn't work server-side — fetch all, filter here
    const res = await fetch(`${getIssuerVisionUrl()}/vision/rounds/active`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    const data = await res.json()
    let rounds = data.rounds ?? (Array.isArray(data) ? data : [])

    // Client-side source filter: match keccak256(source + suffix) against round's source_id
    if (sourceFilter && rounds.length > 0) {
      const hashes = new Set<string>()
      for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
        hashes.add(keccak256(toHex(sourceFilter + suffix)).toLowerCase())
      }
      rounds = rounds.filter((r: any) => {
        const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
        return hashes.has(sid) || sid === sourceFilter.toLowerCase()
      })
    }

    return Response.json({ rounds })
  } catch (e) {
    console.error('Vision rounds proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
