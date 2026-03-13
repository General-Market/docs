import { NextRequest, NextResponse } from 'next/server'
import { computeEnrichment } from '@/lib/api/itp-enrichment'

// Strict itp_id validation — prevents SSRF and query injection
const ITP_ID_RE = /^0x[0-9a-fA-F]{64}$/

export async function GET(request: NextRequest) {
  const itpId = request.nextUrl.searchParams.get('itp_id')

  if (!itpId || !ITP_ID_RE.test(itpId)) {
    return NextResponse.json({ error: 'Invalid itp_id' }, { status: 400 })
  }

  try {
    const result = await computeEnrichment(itpId)

    const hasMeaningfulData = result.holdings.length > 0
    const cacheHeader = hasMeaningfulData
      ? 'public, s-maxage=300, stale-while-revalidate=60'
      : 'private, no-cache'

    return NextResponse.json(result, {
      headers: { 'Cache-Control': cacheHeader },
    })
  } catch (err) {
    console.error('[itp-enrichment]', err)
    return NextResponse.json({ error: 'Enrichment unavailable' }, { status: 500 })
  }
}
