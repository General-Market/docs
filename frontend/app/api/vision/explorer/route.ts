import { getIssuerVisionUrl } from '@/lib/config'

export async function GET() {
  try {
    const res = await fetch(`${getIssuerVisionUrl()}/vision/explorer/stats`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return Response.json(await res.json())

    // Fallback: aggregate from leaderboard + batches
    const [batchRes, lbRes] = await Promise.all([
      fetch(`${getIssuerVisionUrl()}/vision/batches`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
      fetch(`${getIssuerVisionUrl()}/vision/leaderboard`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
    ])
    const batches = batchRes.ok ? (await batchRes.json()).batches ?? [] : []
    const leaderboard = lbRes.ok ? (await lbRes.json()).leaderboard ?? [] : []

    // Per-source stats from batches
    const sourceStats = batches.map((b: any) => ({
      sourceId: b.source_id,
      batchId: b.id,
      playerCount: b.player_count ?? 0,
      marketCount: b.market_count ?? 0,
      tickDuration: b.tick_duration ?? 0,
    }))

    return Response.json({
      sources: sourceStats,
      leaderboard: leaderboard.slice(0, 20),
      totalSources: batches.length,
      totalPlayers: leaderboard.length,
    })
  } catch (e) {
    return Response.json({ sources: [], leaderboard: [], totalSources: 0, totalPlayers: 0 }, { status: 502 })
  }
}
