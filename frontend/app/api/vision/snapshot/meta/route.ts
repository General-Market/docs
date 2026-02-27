import { NextResponse } from 'next/server'

const AA_DATA_NODE = process.env.AA_DATA_NODE_URL || 'http://localhost:8200'

export async function GET() {
  try {
    // Use admin/sources/health for accurate per-source data (same as /sources page)
    const res = await fetch(`${AA_DATA_NODE}/admin/sources/health`, {
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) throw new Error(`admin health ${res.status}`)
    const data = await res.json()
    const rawSources: Array<Record<string, unknown>> = data.sources ?? []

    const assetCounts: Record<string, number> = {}
    let totalAssetCount = 0

    const sources = rawSources.map(s => {
      const sourceId = s.sourceId as string
      const total = (s.totalAssets as number) ?? 0
      // Use totalAssets — stale just means "not recently refreshed", assets still have valid prices
      assetCounts[sourceId] = total
      totalAssetCount += total
      return {
        sourceId,
        displayName: (s.displayName as string) ?? sourceId,
        enabled: true,
        syncIntervalSecs: (s.syncIntervalSecs as number) ?? 300,
        lastSync: (s.newestRecord as string) ?? null,
        nextSync: null,
        estimatedNextUpdate: null,
        status: (s.status as string) ?? 'stale',
      }
    })

    return NextResponse.json({
      generatedAt: data.generatedAt ?? new Date().toISOString(),
      totalAssets: totalAssetCount,
      totalSources: sources.length,
      totalCategories: 0,
      sources,
      assetCounts,
    })
  } catch (err) {
    console.error('Vision meta proxy error:', err)
    return NextResponse.json(
      { error: 'Upstream service unavailable' },
      { status: 502 },
    )
  }
}
