import { getVisionOracleUrls } from '@/lib/config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string; assetId: string }> },
) {
  const { sourceId, assetId } = await params
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams(searchParams)
  const path = `/vision/asset/${encodeURIComponent(sourceId)}/${encodeURIComponent(assetId)}/settlements?${qs}`

  // Race all three oracles in parallel. They share a postgres so the answer
  // is identical; whichever oracle finishes first wins, the others get
  // discarded. Failing serially (20s × 3) routinely exceeded the user's
  // patience when one oracle was restarting.
  const oracles = getVisionOracleUrls()
  const controllers = oracles.map(() => new AbortController())
  // Outer budget — nginx upstream is 60s; stay well under so the route
  // returns 503 before the platform 504s us.
  const deadline = setTimeout(() => controllers.forEach(c => c.abort()), 35_000)

  const attempts = oracles.map(async (base, i) => {
    const res = await fetch(`${base}${path}`, {
      cache: 'no-store',
      signal: controllers[i].signal,
    })
    if (!res.ok) throw new Error(`${base} → ${res.status}`)
    return res.json()
  })

  try {
    const winner = await Promise.any(attempts)
    controllers.forEach(c => c.abort())
    return Response.json(winner)
  } catch (e) {
    const reasons =
      e instanceof AggregateError
        ? e.errors.map(err => (err as Error).message).join(' | ')
        : (e as Error).message
    console.error('Vision asset settlements proxy error:', reasons)
  } finally {
    clearTimeout(deadline)
  }
  // 503 — temporary unavailability — lets the client distinguish from
  // a 200 with an empty `settlements` array (which means "no participants").
  return Response.json(
    { settlements: [], error: 'upstream_unavailable' },
    { status: 503 },
  )
}
