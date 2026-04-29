export type FillBreakdownHolding = {
  symbol: string
  address: string
  price: number       // current display price; 0 means unknown
  weight: number      // 0..1, kept for display continuity
  image?: string
}

export type FillBreakdownInventory = {
  address: string
  qtyPerShare: bigint // 18-dec token units per 1e18 shares
}

export type FillBreakdownRow = {
  symbol: string
  image?: string
  qtyAcquired: number      // float, decimal token units
  price: number | null     // null when unknown
  usd: number | null       // null when price unknown
  weight: number
}

export type FillBreakdownArgs = {
  fillAmount: bigint  // 18-dec USDC paid
  fillPrice: bigint   // 18-dec NAV per share at fill
  holdings: FillBreakdownHolding[]
  inventory: FillBreakdownInventory[]
}

const ONE = 10n ** 18n

export function computeFillBreakdown(args: FillBreakdownArgs): FillBreakdownRow[] {
  const { fillAmount, fillPrice, holdings, inventory } = args
  if (fillPrice === 0n || fillAmount === 0n) return []

  const sharesBn = (fillAmount * ONE) / fillPrice

  const invByAddr = new Map<string, bigint>()
  for (const inv of inventory) invByAddr.set(inv.address.toLowerCase(), inv.qtyPerShare)

  const rows: FillBreakdownRow[] = []
  for (const h of holdings) {
    const qtyPerShareBn = invByAddr.get(h.address.toLowerCase())
    if (qtyPerShareBn === undefined) continue

    const qtyAcquired = Number(qtyPerShareBn * sharesBn) / 1e36
    const price = h.price > 0 ? h.price : null
    const usd = price === null ? null : qtyAcquired * price

    rows.push({
      symbol: h.symbol,
      image: h.image,
      qtyAcquired,
      price,
      usd,
      weight: h.weight,
    })
  }
  return rows
}
