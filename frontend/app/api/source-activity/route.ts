import { getHomeFeeds, type SourceFeed } from '@/lib/vision/adapters'

export const revalidate = 60

/**
 * Returns the small set of sourceIds whose recent activity dwarfs their
 * 24h baseline — surfaced in the Watchlist sidebar as a subtle blue dot.
 *
 * The signal: average of the last 3 buckets vs. average of buckets 5..30
 * preceding them. Top 3 by absolute relative delta win the dot. We never
 * fabricate movement — sources with empty or flat series are excluded.
 */
function rankFresh(feeds: Record<string, SourceFeed>): string[] {
  const scored: Array<{ id: string; score: number }> = []
  for (const [id, feed] of Object.entries(feeds)) {
    const s = feed.series.filter(Number.isFinite)
    if (s.length < 12) continue

    const recent = s.slice(-3)
    const baseline = s.slice(-30, -5)
    if (baseline.length < 5) continue

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length
    if (!Number.isFinite(baselineAvg) || baselineAvg <= 0) continue

    const score = Math.abs((recentAvg - baselineAvg) / baselineAvg)
    if (score < 0.005) continue
    scored.push({ id, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((x) => x.id)
}

export async function GET() {
  try {
    const feeds = await getHomeFeeds()
    const fresh = rankFresh(feeds)
    return Response.json(
      { fresh },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    )
  } catch {
    return Response.json({ fresh: [] }, { status: 200 })
  }
}
