import { getAaDataNodeUrl, getDataNodeServer } from '@/lib/config'
import itpIdNames from '@/lib/itp-id-names.json'

const ITP_NAMES = itpIdNames as Record<string, { name: string; ticker: string }>

function getItpName(itpId: string, fallbackNum: number): string {
  const override = ITP_NAMES[itpId.toLowerCase()]
  return override?.name || `ITP #${fallbackNum}`
}

function getItpSymbol(itpId: string, fallbackNum: number): string {
  const override = ITP_NAMES[itpId.toLowerCase()]
  return override?.ticker || `ITP${fallbackNum}`
}

export interface ItpSummary {
  itpId: string
  name: string
  symbol: string
  nav: number
  aum: number
  assetCount: number
}

/**
 * Fetch ITP summaries from data-node /aum-ranking endpoint (server-side only).
 * Used for SSR SEO shell + sitemap + JSON-LD.
 * ISR revalidate 60s via Next.js fetch cache.
 */
export async function getItpSummaries(): Promise<ItpSummary[]> {
  try {
    const res = await fetch(`${getAaDataNodeUrl()}/aum-ranking`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok) return []
    const data = await res.json()

    // Endpoint returns { snapshots: [...], all_symbols: {...} }
    const items: any[] = Array.isArray(data) ? data : (data?.snapshots ?? [])
    if (items.length === 0) return []

    return items.map((item: any) => ({
      itpId: item.itp_id || '',
      name: item.name || getItpName(item.itp_id, parseItpNumber(item.itp_id)),
      symbol: item.symbol || getItpSymbol(item.itp_id, parseItpNumber(item.itp_id)),
      nav: item.nav_per_share || 0,
      aum: item.aum_usd || 0,
      assetCount: (item.ranked || []).length || item.asset_count || 0,
    }))
  } catch {
    return []
  }
}

/**
 * Fetch detail for a single ITP (server-side).
 * Calls data-node directly for /itp-price and /snapshot.
 */
export async function getItpDetail(itpId: string): Promise<{
  itpId: string
  name: string
  symbol: string
  nav: number
  aum: number
  assetCount: number
  holdings: { symbol: string; weight: number; price: number }[]
} | null> {
  const dnUrl = getDataNodeServer()
  try {
    const priceRes = await fetch(`${dnUrl}/itp-price?itp_id=${encodeURIComponent(itpId)}`, {
      // ISR-compatible: page sets `revalidate = 300`, this fetch must not opt
      // out via `no-store` (Next.js then 500s the route as "Dynamic server usage").
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    })

    if (!priceRes.ok) {
      console.error(`[getItpDetail] itp-price failed: status=${priceRes.status} url=${dnUrl}/itp-price`)
      return null
    }
    const priceData = await priceRes.json()

    return {
      itpId,
      name: priceData.name || getItpName(itpId, parseItpNumber(itpId)),
      symbol: priceData.symbol || getItpSymbol(itpId, parseItpNumber(itpId)),
      nav: parseFloat(priceData.nav_display) || priceData.nav_per_share || 0,
      aum: priceData.aum_usd || 0,
      assetCount: priceData.assets_total || 0,
      holdings: [], // Holdings resolved by enrichment pipeline via /chain/l3/itp-state
    }
  } catch (e) {
    console.error(`[getItpDetail] error: ${e} url=${dnUrl}/itp-price`)
    return null
  }
}

function parseItpNumber(itpId: string): number {
  try {
    const hex = itpId?.startsWith('0x') ? itpId.slice(2) : itpId || '0'
    return parseInt(hex, 16) || 0
  } catch {
    return 0
  }
}
