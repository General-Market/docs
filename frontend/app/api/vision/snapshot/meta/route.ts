import { NextResponse } from 'next/server'
import { AA_DATA_NODE_URL } from '@/lib/config'

const AA_DATA_NODE = AA_DATA_NODE_URL

interface BulkSourceEntry {
  totalAssets: number
  activeAssets: number
  newestRecord: string | null
}

interface BulkStatsResponse {
  totalAssets: number
  totalActiveAssets: number
  sourceCount: number
  sources: Record<string, BulkSourceEntry>
}

function deriveStatus(entry: BulkSourceEntry): string {
  if (entry.activeAssets === 0) return 'not_started'
  if (!entry.newestRecord) return 'stale'
  const age = Date.now() - new Date(entry.newestRecord).getTime()
  if (age > 7 * 24 * 3600 * 1000) return 'stale' // >7 days = stale
  return 'healthy'
}

export async function GET() {
  try {
    // Single bulk call instead of ~90 individual requests
    const res = await fetch(`${AA_DATA_NODE}/market/stats`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`Bulk stats HTTP ${res.status}`)
    const bulk: BulkStatsResponse = await res.json()

    const assetCounts: Record<string, number> = {}
    const sources = Object.entries(bulk.sources).map(([id, entry]) => {
      assetCounts[id] = entry.totalAssets
      return {
        sourceId: id,
        displayName: id,
        enabled: true,
        syncIntervalSecs: 300,
        lastSync: entry.newestRecord,
        nextSync: null,
        estimatedNextUpdate: null,
        status: deriveStatus(entry),
      }
    })

    const response = NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalAssets: bulk.totalAssets,
      totalSources: sources.filter(s => s.status === 'healthy' || s.status === 'stale').length,
      totalCategories: 10,
      sources,
      assetCounts,
    })

    // Cache for 30s on CDN, serve stale for 60s while revalidating
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    console.error('Vision meta proxy error:', err)
    return NextResponse.json(
      { error: 'Upstream service unavailable' },
      { status: 502 },
    )
  }
}
