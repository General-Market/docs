import { getVisionOracleUrls } from '@/lib/config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string; assetId: string }> },
) {
  const { sourceId, assetId } = await params
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams(searchParams)
  const path = `/vision/asset/${encodeURIComponent(sourceId)}/${encodeURIComponent(assetId)}/settlements?${qs}`

  // Try oracle1 → oracle2 → oracle3. Each oracle restarts on its own schedule;
  // failing over is cheaper than telling the user there are no participants
  // when 1/3 of the oracles is alive with the data.
  const oracles = getVisionOracleUrls()
  const errors: string[] = []
  for (const base of oracles) {
    try {
      const res = await fetch(`${base}${path}`, {
        cache: 'no-store',
        // Oracle JSONB scan + 99-row TOAST detoast can take ~30s under load.
        // nginx upstream is 60s; keep us under it but well above the median.
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) {
        return Response.json(await res.json())
      }
      errors.push(`${base} → ${res.status}`)
    } catch (e) {
      errors.push(`${base} → ${(e as Error).message}`)
    }
  }

  console.error('Vision asset settlements proxy error:', errors.join(' | '))
  // 503 — temporary unavailability — lets the client distinguish from
  // a 200 with an empty `settlements` array (which means "no participants").
  return Response.json(
    { settlements: [], error: 'upstream_unavailable' },
    { status: 503 },
  )
}
