import { keccak256, toHex } from 'viem'
import { getIssuerVisionUrl } from '@/lib/config'
import sourcesDisplay from '@/data/sources-display.json'

// Build reverse mapping: internal sourceId → display sourceId, and keccak hashes
const INTERNAL_TO_DISPLAY: Record<string, string> = {}
const DISPLAY_HASHES: Record<string, Set<string>> = {}
for (const s of (sourcesDisplay as any).sources) {
  const displayId = s.sourceId as string
  const ids: string[] = s.internalIds ?? [displayId]
  const hashes = new Set<string>()
  for (const iid of ids) {
    INTERNAL_TO_DISPLAY[iid.toLowerCase()] = displayId
    for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
      const hash = keccak256(toHex(iid + suffix)).toLowerCase()
      INTERNAL_TO_DISPLAY[hash] = displayId
      hashes.add(hash)
    }
    hashes.add(iid.toLowerCase())
  }
  DISPLAY_HASHES[displayId.toLowerCase()] = hashes
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceFilter = searchParams.get('source')

    const res = await fetch(`${getIssuerVisionUrl()}/vision/rounds/active`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    const data = await res.json()
    let rounds = data.rounds ?? (Array.isArray(data) ? data : [])

    // Resolve oracle internal sourceIds to display sourceIds
    for (const r of rounds) {
      const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
      const display = INTERNAL_TO_DISPLAY[sid]
      if (display) {
        r.source_id = display
        r.sourceId = display
      }
    }

    // Filter by display sourceId
    if (sourceFilter && rounds.length > 0) {
      const filterLower = sourceFilter.toLowerCase()
      const matchHashes = DISPLAY_HASHES[filterLower] ?? new Set<string>()
      rounds = rounds.filter((r: any) => {
        const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
        return sid === filterLower || matchHashes.has(sid)
      })
    }

    return Response.json({ rounds })
  } catch (e) {
    console.error('Vision rounds proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
