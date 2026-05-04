// Aggregate vault portfolio by asset.
// The trades table stores user_address — vaults trade as their own wallet.
// We hit /portfolio/trades?user=<vaultAddress> on the data-node, then
// aggregate per itp_id: fills count, volume, VWAP entry, realized PnL.
// Unrealized PnL requires a live NAV per asset; we stub it as null until
// the nav endpoint can be queried at scale.

import { NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'
import { getAddress } from 'viem'

export const dynamic = 'force-dynamic'

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

interface AssetAgg {
  assetId: string
  fillsCount: number
  totalVolume: number
  avgEntry: number | null
  realizedPnl: number
  unrealizedPnl: null
  lastFillAt: string | null
  trend: 'up' | 'down' | 'flat'
}

function computeAgg(trades: RawTrade[]): AssetAgg[] {
  const byAsset = new Map<string, RawTrade[]>()

  for (const t of trades) {
    if (t.status !== 'filled') continue
    const bucket = byAsset.get(t.itp_id) ?? []
    bucket.push(t)
    byAsset.set(t.itp_id, bucket)
  }

  const result: AssetAgg[] = []

  for (const [assetId, rows] of byAsset.entries()) {
    rows.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))

    let sharesHeld = 0
    let costBasis = 0
    let realizedPnl = 0
    let totalVolume = 0
    let totalBuyValue = 0
    let totalBuyShares = 0
    let lastFillAt: string | null = null

    for (const t of rows) {
      const shares = t.shares ? parseFloat(t.shares) : 0
      const price = t.fill_price ? parseFloat(t.fill_price) : 0
      const volume = t.amount ? parseFloat(t.amount) : 0
      totalVolume += volume
      lastFillAt = t.timestamp

      if (t.side === 'BUY') {
        sharesHeld += shares
        costBasis += shares * price
        totalBuyValue += shares * price
        totalBuyShares += shares
      } else {
        // SELL: realize PnL proportional to cost basis
        if (sharesHeld > 0) {
          const avgCost = costBasis / sharesHeld
          const pnl = shares * (price - avgCost)
          realizedPnl += pnl
          sharesHeld = Math.max(0, sharesHeld - shares)
          costBasis = sharesHeld * avgCost
        }
      }
    }

    const avgEntry = totalBuyShares > 0 ? totalBuyValue / totalBuyShares : null

    // Trend: sign of realized PnL
    const trend: 'up' | 'down' | 'flat' =
      realizedPnl > 0.001 ? 'up' : realizedPnl < -0.001 ? 'down' : 'flat'

    result.push({
      assetId,
      fillsCount: rows.length,
      totalVolume,
      avgEntry,
      realizedPnl,
      unrealizedPnl: null, // requires per-asset NAV — stubbed
      lastFillAt,
      trend,
    })
  }

  // Sort by |realizedPnl| desc as default
  result.sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl))

  return result
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: vaultAddress } = await params

  let checksummed: string
  try {
    checksummed = getAddress(vaultAddress).toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${getAaDataNodeUrl()}/portfolio/trades?user=${encodeURIComponent(checksummed)}`,
      { signal: AbortSignal.timeout(10_000), cache: 'no-store' },
    )

    if (!res.ok) {
      console.error('[vault/assets] data-node returned', res.status)
      return NextResponse.json(
        { assets: [], _stub: true, reason: `data-node /portfolio/trades returned ${res.status}` },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const body = await res.json()
    const trades: RawTrade[] = body.trades ?? []

    const assets = computeAgg(trades)

    return NextResponse.json(
      { assets, total: assets.length },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[vault/assets]', message)
    return NextResponse.json(
      { assets: [], _stub: true, reason: message },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
