import { AA_DATA_NODE_URL } from '@/lib/config'

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
    const res = await fetch(`${AA_DATA_NODE_URL}/aum-ranking`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()

    if (!Array.isArray(data)) return []

    return data.map((item: any) => ({
      itpId: item.itp_id || '',
      name: item.name || `ITP #${parseItpNumber(item.itp_id)}`,
      symbol: item.symbol || `ITP${parseItpNumber(item.itp_id)}`,
      nav: item.nav_per_share || 0,
      aum: item.aum_usd || 0,
      assetCount: item.asset_count || 0,
    }))
  } catch {
    return []
  }
}

/**
 * Fetch detail for a single ITP (server-side).
 * Combines /itp-price and /snapshot data.
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
  try {
    const [priceRes, snapshotRes] = await Promise.all([
      fetch(`${AA_DATA_NODE_URL}/itp-price?itp_id=${itpId}`, {
        next: { revalidate: 60 },
      }),
      fetch(`${AA_DATA_NODE_URL}/snapshot?itp_id=${itpId}`, {
        next: { revalidate: 60 },
      }),
    ])

    if (!priceRes.ok) return null
    const priceData = await priceRes.json()

    let holdings: { symbol: string; weight: number; price: number }[] = []
    if (snapshotRes.ok) {
      const snapshot = await snapshotRes.json()
      if (Array.isArray(snapshot.assets)) {
        holdings = snapshot.assets.map((a: any) => ({
          symbol: a.symbol || '',
          weight: a.weight || 0,
          price: a.price || 0,
        }))
      }
    }

    return {
      itpId,
      name: priceData.name || `ITP #${parseItpNumber(itpId)}`,
      symbol: priceData.symbol || `ITP${parseItpNumber(itpId)}`,
      nav: priceData.nav_per_share || 0,
      aum: priceData.aum_usd || 0,
      assetCount: priceData.assets_total || holdings.length,
      holdings,
    }
  } catch {
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
