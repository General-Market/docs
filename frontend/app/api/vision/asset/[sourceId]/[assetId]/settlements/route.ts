import { getVisionOracleUrls } from '@/lib/config'

/**
 * Per-attempt budget — how long we are willing to wait on a single oracle
 * before giving up on it and letting Promise.any pick whichever of the
 * remaining two answered. This is the value that matters during oracle
 * rolling restarts: a freshly-recreated container is reachable on TCP
 * (nginx connects) but may take several seconds to finish loading state
 * before it answers. We want that window short enough that the page
 * doesn't sit on "Loading participants…" for half a minute, but long
 * enough that a healthy oracle returning a 200-row settlement page
 * (typically 3–5s) still wins.
 */
const PER_ATTEMPT_MS = 6_000

/**
 * Outer budget — hard ceiling on the whole proxy call. With three
 * oracles racing under PER_ATTEMPT_MS, the all-fail case bounces back
 * inside PER_ATTEMPT_MS. The extra room here just lets a slow-and-steady
 * winner cross the line.
 */
const TOTAL_BUDGET_MS = 8_000

/**
 * Status codes that mean "this oracle is the wrong one to wait on" —
 * connection-level failures and upstream errors. Promise.any keeps
 * waiting on the others; the client sees the healthy one's answer.
 */
function isHardFail(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status >= 500
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string; assetId: string }> },
) {
  const { sourceId, assetId } = await params
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams(searchParams)
  const path = `/vision/asset/${encodeURIComponent(sourceId)}/${encodeURIComponent(assetId)}/settlements?${qs}`

  const oracles = getVisionOracleUrls()

  // The outer abort enforces TOTAL_BUDGET_MS regardless of what any
  // individual attempt is doing — if every oracle is being slow, the
  // caller gets a clean 503 instead of a hung socket.
  const outerAbort = new AbortController()
  const outerTimer = setTimeout(() => outerAbort.abort(), TOTAL_BUDGET_MS)

  const attempts = oracles.map(async (base) => {
    // Per-attempt abort — drops dead/hung oracles fast so Promise.any
    // moves on. Linked to the outer abort: if the outer budget pops,
    // all in-flight attempts cancel too.
    const innerAbort = new AbortController()
    const innerTimer = setTimeout(() => innerAbort.abort(), PER_ATTEMPT_MS)
    const onOuterAbort = () => innerAbort.abort()
    outerAbort.signal.addEventListener('abort', onOuterAbort, { once: true })

    try {
      const res = await fetch(`${base}${path}`, {
        cache: 'no-store',
        signal: innerAbort.signal,
      })
      if (isHardFail(res.status)) {
        // Drop a 502/upstream-closed inside one network roundtrip
        // so Promise.any picks the healthier oracle. The original
        // code did this too, but only after a 35-second outer budget
        // had also expired on every parallel attempt.
        throw new Error(`${base} → ${res.status}`)
      }
      if (!res.ok) {
        throw new Error(`${base} → ${res.status}`)
      }
      return await res.json()
    } finally {
      clearTimeout(innerTimer)
      outerAbort.signal.removeEventListener('abort', onOuterAbort)
    }
  })

  try {
    const winner = await Promise.any(attempts)
    return Response.json(winner)
  } catch (e) {
    const reasons =
      e instanceof AggregateError
        ? e.errors.map((err) => (err as Error).message).join(' | ')
        : (e as Error).message
    console.error('Vision asset settlements proxy error:', reasons)
    // 503 — temporary unavailability — lets the client distinguish from
    // a 200 with an empty `settlements` array (which means "no participants").
    return Response.json(
      { settlements: [], error: 'upstream_unavailable' },
      { status: 503 },
    )
  } finally {
    clearTimeout(outerTimer)
    outerAbort.abort()
  }
}
