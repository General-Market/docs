/**
 * Shared oracle infrastructure health checks.
 * Quick probes for oracle nodes and Vision API — import from any test
 * to gate execution on live infrastructure.
 */

import { ORACLE_URLS, VISION_API } from '../env'

const PROBE_TIMEOUT = 5_000

/**
 * Quick probe: is at least one oracle healthy? (5s timeout)
 * Hits /health on each ORACLE_URL, returns true if any responds without a 5xx.
 */
export async function isOracleHealthy(): Promise<boolean> {
  const probes = ORACLE_URLS.map(async (url) => {
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT),
      })
      return res.ok || res.status < 500
    } catch {
      return false
    }
  })
  const results = await Promise.all(probes)
  return results.some(Boolean)
}

/**
 * Quick probe: does Vision API respond (not 500)? (5s timeout)
 * Hits /health on the Vision API (data-node) URL.
 */
export async function isVisionApiUp(): Promise<boolean> {
  try {
    const res = await fetch(`${VISION_API}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
    })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

/**
 * Combined check: skip message if either oracle or Vision API is down.
 * Returns { ok: true } when both are reachable, or { ok: false, reason } describing what failed.
 */
export async function checkOracleInfra(): Promise<{ ok: boolean; reason?: string }> {
  const [oracleUp, visionUp] = await Promise.all([
    isOracleHealthy(),
    isVisionApiUp(),
  ])

  if (oracleUp && visionUp) return { ok: true }

  const failures: string[] = []
  if (!oracleUp) failures.push('all oracles unreachable')
  if (!visionUp) failures.push(`Vision API down (${VISION_API})`)

  return { ok: false, reason: failures.join('; ') }
}
