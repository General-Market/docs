// Paginated fills for a (vault, asset) pair.
// Filters /portfolio/trades by itp_id, returns page-sliced fills
// with normalized numeric values for chart overlay.

import { NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'
import { getAddress } from 'viem'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500

interface RawTrade {
  order_id: number
  itp_id: string
  side: string
  amount: string
  fill_price: string | null
  shares: string | null
  status: string
  timestamp: string
}

export interface FillEntry {
  orderId: number
  side: 'BUY' | 'SELL'
  /** USD value of the fill */
  amount: number
  /** Price per share (NAV) at fill time */
  fillPrice: number | null
  /** Shares traded */
  shares: number | null
  timestamp: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vaultAddress: string; assetId: string }> },
) {
  const { vaultAddress, assetId } = await params
  const { searchParams } = new URL(request.url)
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10)
  const limit = Math.min(Math.max(1, rawLimit), MAX_PAGE_SIZE)

  let checksummed: string
  try {
    checksummed = getAddress(vaultAddress).toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
  }

  const decodedAsset = decodeURIComponent(assetId)

  try {
    const res = await fetch(
      `${getAaDataNodeUrl()}/portfolio/trades?user=${encodeURIComponent(checksummed)}`,
      { signal: AbortSignal.timeout(10_000), cache: 'no-store' },
    )

    if (!res.ok) {
      return NextResponse.json(
        { fills: [], total: 0, _stub: true, reason: `data-node /portfolio/trades returned ${res.status}` },
        { status: 200 },
      )
    }

    const body = await res.json()
    const allTrades: RawTrade[] = body.trades ?? []

    const forAsset = allTrades
      .filter((t) => t.itp_id === decodedAsset && t.status === 'filled')
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))

    const total = forAsset.length
    const pageSlice = forAsset.slice(page * limit, page * limit + limit)

    const fills: FillEntry[] = pageSlice.map((t) => ({
      orderId: t.order_id,
      side: t.side === 'BUY' ? 'BUY' : 'SELL',
      amount: t.amount ? parseFloat(t.amount) : 0,
      fillPrice: t.fill_price ? parseFloat(t.fill_price) : null,
      shares: t.shares ? parseFloat(t.shares) : null,
      timestamp: t.timestamp,
    }))

    return NextResponse.json(
      { fills, total, page, limit },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[vault/assets/fills]', message)
    return NextResponse.json(
      { fills: [], total: 0, _stub: true, reason: message },
      { status: 200 },
    )
  }
}
