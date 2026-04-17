import { getAaDataNodeUrl as getDataNodeUrl } from '@/lib/config'

export async function GET() {
  try {
    // Fast path: ask the data-node for its tracked symbol count
    const res = await fetch(`${getDataNodeUrl()}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`DN ${res.status}`)
    const health = await res.json()
    // health.symbols_tracked is the unique market count
    const count = health.symbols_tracked ?? 0
    return Response.json({ count })
  } catch {
    return Response.json({ count: 0 })
  }
}
