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
  isApprox: boolean        // true when row falls back to weight-based math (legacy ITP, no inventory)
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

  const fillAmountFloat = Number(fillAmount) / 1e18

  const rows: FillBreakdownRow[] = []
  for (const h of holdings) {
    const qtyPerShareBn = h.address ? invByAddr.get(h.address.toLowerCase()) : undefined
    const price = h.price > 0 ? h.price : null

    let qtyAcquired: number
    let isApprox: boolean
    if (qtyPerShareBn !== undefined) {
      qtyAcquired = Number(qtyPerShareBn * sharesBn) / 1e36
      isApprox = false
    } else {
      // Legacy ITP fallback: weight × fillAmount / price. Approximation —
      // diverges from the real basket if asset prices have moved since fill,
      // but it keeps the UI honest about *what was bought* until the chain
      // grows an inventory entry for this ITP.
      qtyAcquired = price !== null ? (fillAmountFloat * h.weight) / price : 0
      isApprox = true
    }

    const usd = price === null ? null : qtyAcquired * price

    rows.push({
      symbol: h.symbol,
      image: h.image,
      qtyAcquired,
      price,
      usd,
      weight: h.weight,
      isApprox,
    })
  }
  return rows
}
