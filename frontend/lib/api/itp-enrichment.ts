import { promises as fs } from 'fs'
import path from 'path'
import { AA_DATA_NODE_URL } from '@/lib/config'
import { normalizeUniversityName } from '@/lib/university-logos'
import type {
  CoinMapEntry,
  EnrichedHolding,
  FounderAggregates,
  DefiAggregates,
  FundingAggregates,
  ItpEnrichment,
} from '@/lib/itp-enrichment-types'

// ─── Process-level caches (survive across requests within same lambda) ───
let coinMapCache: Record<string, CoinMapEntry> | null = null
let foundersLookupCache: Record<string, { age?: number; gender: string; nationality: string; university?: string }[]> | null = null

// DeFiLlama + CoinGecko caches with TTL (5 min)
let defiProtocolsCache: { data: any[]; ts: number } | null = null
let defiRaisesCache: { data: any[]; ts: number } | null = null
let cgPriceCache: { data: Record<string, { usd?: number; usd_market_cap?: number; usd_24h_change?: number }>; ts: number } | null = null
const DEFI_CACHE_TTL = 5 * 60 * 1000

async function loadCoinMap(): Promise<Record<string, CoinMapEntry>> {
  if (coinMapCache) return coinMapCache
  const raw = await fs.readFile(path.join(process.cwd(), 'public/coin-map.json'), 'utf-8')
  coinMapCache = JSON.parse(raw)
  return coinMapCache!
}

async function loadFoundersLookup(): Promise<typeof foundersLookupCache> {
  if (foundersLookupCache) return foundersLookupCache
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data/founders-lookup.json'), 'utf-8')
    foundersLookupCache = JSON.parse(raw)
  } catch {
    foundersLookupCache = {}
  }
  return foundersLookupCache!
}

function buildFounderAggregates(
  holdings: { symbol: string; coingecko_id?: string }[],
  lookup: Record<string, { age?: number; gender: string; nationality: string; university?: string }[]>
): FounderAggregates | undefined {
  const matchedFounders: { age?: number; gender: string; nationality: string; university?: string }[] = []
  let companiesMatched = 0

  for (const h of holdings) {
    if (!h.coingecko_id) continue
    const founders = lookup[h.coingecko_id]
    if (!founders?.length) continue
    companiesMatched++
    matchedFounders.push(...founders)
  }

  if (matchedFounders.length === 0) return undefined

  const ageBuckets: Record<string, number> = { '20-29': 0, '30-39': 0, '40-49': 0, '50-59': 0, '60+': 0 }
  for (const f of matchedFounders) {
    if (!f.age) continue
    if (f.age < 30) ageBuckets['20-29']++
    else if (f.age < 40) ageBuckets['30-39']++
    else if (f.age < 50) ageBuckets['40-49']++
    else if (f.age < 60) ageBuckets['50-59']++
    else ageBuckets['60+']++
  }

  const genderMap: Record<string, number> = {}
  for (const f of matchedFounders) {
    const g = f.gender === 'male' ? 'Male' : f.gender === 'female' ? 'Female' : 'Unknown'
    genderMap[g] = (genderMap[g] || 0) + 1
  }

  const natMap: Record<string, number> = {}
  for (const f of matchedFounders) {
    if (f.nationality && f.nationality !== 'Unknown') {
      natMap[f.nationality] = (natMap[f.nationality] || 0) + 1
    }
  }

  const uniMap: Record<string, number> = {}
  for (const f of matchedFounders) {
    if (!f.university || f.university === 'Unknown') continue
    // Split compound entries like "Peking University, University of Pennsylvania"
    const parts = f.university.split(',').map(s => s.trim()).filter(Boolean)
    for (let raw of parts) {
      // Strip parenthetical noise like "(2008)", "(founded 2008)", "(dropout)"
      raw = raw.replace(/\s*\([^)]*\)\s*/g, '').trim()
      // Filter out bare "University" with no specific name
      if (/^University$/i.test(raw)) continue
      // Filter out entries starting with "unknown"
      if (/^unknown/i.test(raw)) continue
      // Filter out bare years or empty strings
      if (!raw || /^\d{4}$/.test(raw)) continue
      // Normalize to canonical name for dedup (e.g. "Berkeley" → "UC Berkeley")
      const normalized = normalizeUniversityName(raw)
      uniMap[normalized] = (uniMap[normalized] || 0) + 1
    }
  }

  const sortDesc = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

  return {
    total_founders: matchedFounders.length,
    total_companies_matched: companiesMatched,
    age_distribution: Object.entries(ageBuckets).map(([bucket, count]) => ({ bucket, count })),
    gender_split: sortDesc(genderMap),
    top_nationalities: sortDesc(natMap).slice(0, 12),
    top_universities: sortDesc(uniMap).slice(0, 10),
  }
}

async function fetchCoinGeckoMarketData(
  cgIds: string[]
): Promise<Record<string, { usd?: number; usd_market_cap?: number; usd_24h_change?: number }>> {
  if (cgIds.length === 0) return {}
  if (cgPriceCache && Date.now() - cgPriceCache.ts < DEFI_CACHE_TTL) {
    return cgPriceCache.data
  }
  try {
    const batches: string[][] = []
    for (let i = 0; i < cgIds.length; i += 200) {
      batches.push(cgIds.slice(i, i + 200))
    }
    const merged: Record<string, { usd?: number; usd_market_cap?: number; usd_24h_change?: number }> = {}
    for (const batch of batches) {
      const ids = batch.join(',')
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const [id, vals] of Object.entries(data) as [string, any][]) {
        merged[id] = {
          usd: vals.usd,
          usd_market_cap: vals.usd_market_cap,
          usd_24h_change: vals.usd_24h_change,
        }
      }
    }
    cgPriceCache = { data: merged, ts: Date.now() }
    return merged
  } catch {
    return cgPriceCache?.data || {}
  }
}

async function fetchDefiProtocolsCached(): Promise<any[]> {
  if (defiProtocolsCache && Date.now() - defiProtocolsCache.ts < DEFI_CACHE_TTL) {
    return defiProtocolsCache.data
  }
  try {
    const res = await fetch(`${AA_DATA_NODE_URL}/defillama/protocols`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return defiProtocolsCache?.data || []
    const data = await res.json()
    defiProtocolsCache = { data, ts: Date.now() }
    return data
  } catch {
    return defiProtocolsCache?.data || []
  }
}

async function fetchDefiData(
  holdings: { symbol: string; coingecko_id?: string }[]
): Promise<DefiAggregates | undefined> {
  try {
    const protocols = await fetchDefiProtocolsCached()
    const protoLookup = new Map<string, any>()
    for (const p of protocols) {
      if (p.gecko_id) protoLookup.set(p.gecko_id, p)
    }

    const matched: { symbol: string; name: string; tvl: number; change_1d?: number; change_7d?: number }[] = []
    for (const h of holdings) {
      if (!h.coingecko_id) continue
      const proto = protoLookup.get(h.coingecko_id)
      if (!proto?.tvl) continue
      matched.push({
        symbol: h.symbol,
        name: proto.name || h.symbol,
        tvl: proto.tvl,
        change_1d: proto.change_1d ?? proto.tvl_change_1d,
        change_7d: proto.change_7d ?? proto.tvl_change_7d,
      })
    }

    if (matched.length === 0) return undefined

    const totalTvl = matched.reduce((s, m) => s + m.tvl, 0)
    const avgChange7d = matched.reduce((s, m) => s + (m.change_7d || 0), 0) / matched.length

    return {
      total_tvl: totalTvl,
      avg_tvl_change_7d: avgChange7d,
      protocols_with_data: matched.length,
      total_holdings: holdings.length,
      top_by_tvl: matched.sort((a, b) => b.tvl - a.tvl).slice(0, 10),
    }
  } catch {
    return undefined
  }
}

async function fetchRaisesCached(): Promise<any[]> {
  if (defiRaisesCache && Date.now() - defiRaisesCache.ts < DEFI_CACHE_TTL) {
    return defiRaisesCache.data
  }
  try {
    const res = await fetch(`${AA_DATA_NODE_URL}/defillama/raises`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return defiRaisesCache?.data || []
    const data = await res.json()
    defiRaisesCache = { data, ts: Date.now() }
    return data
  } catch {
    return defiRaisesCache?.data || []
  }
}

async function fetchFundingData(
  holdings: { symbol: string; coingecko_id?: string }[]
): Promise<FundingAggregates | undefined> {
  try {
    const raises = await fetchRaisesCached()
    const cgIds = new Set(holdings.map(h => h.coingecko_id).filter(Boolean))
    const holdingNames = new Set(holdings.map(h => h.symbol.toLowerCase()))

    const matchedRaises: any[] = []
    for (const r of raises) {
      const rid = r.defillama_id?.toLowerCase()
      const rname = r.name?.toLowerCase()
      if ((rid && cgIds.has(rid)) || (rname && holdingNames.has(rname))) {
        matchedRaises.push(r)
      }
    }

    if (matchedRaises.length === 0) return undefined

    const totalRaised = matchedRaises.reduce((s, r) => s + (r.amount_m || r.amount || 0), 0)
    const withValuation = matchedRaises.filter(r => r.valuation_m || r.valuation)
    const avgVal = withValuation.length > 0
      ? withValuation.reduce((s, r) => s + (r.valuation_m || r.valuation || 0), 0) / withValuation.length
      : 0

    const investorCount: Record<string, number> = {}
    for (const r of matchedRaises) {
      for (const inv of (r.lead_investors || [])) {
        investorCount[inv] = (investorCount[inv] || 0) + 1
      }
    }

    return {
      total_raised_m: totalRaised,
      avg_valuation_m: avgVal,
      total_rounds: matchedRaises.length,
      top_investors: Object.entries(investorCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recent_raises: matchedRaises
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .slice(0, 10)
        .map(r => ({
          project: r.name || '',
          round: r.round || '',
          amount_m: r.amount_m || r.amount || 0,
          lead: (r.lead_investors || [])[0] || '—',
          date: r.date ? new Date(r.date * 1000).toISOString().slice(0, 10) : undefined,
        })),
    }
  } catch {
    return undefined
  }
}

/** Core enrichment logic — usable from both the API route and server components */
export async function computeEnrichment(itpId: string): Promise<ItpEnrichment> {
  let rawHoldings: { symbol: string; weight: number; price: number; name: string }[] = []
  try {
    const snapshotRes = await fetch(
      `${AA_DATA_NODE_URL}/snapshot?itp_id=${encodeURIComponent(itpId)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (snapshotRes.ok) {
      const snapshot = await snapshotRes.json()
      rawHoldings = (snapshot.assets || []).map((a: any) => ({
        symbol: a.symbol || '',
        weight: a.weight || 0,
        price: a.price || 0,
        name: a.name || a.symbol || '',
      }))
    }
  } catch {
    // Snapshot endpoint down — fallback below
  }

  // Fallback: load holdings from deployed-assets.json (equal weight ITP #1)
  if (rawHoldings.length === 0) {
    try {
      const assetsRaw = await fs.readFile(path.join(process.cwd(), 'public/deployed-assets.json'), 'utf-8')
      const assets: { symbol: string; address: string }[] = JSON.parse(assetsRaw)
      const equalWeight = 1 / assets.length
      rawHoldings = assets.map(a => ({
        symbol: a.symbol,
        weight: equalWeight,
        price: 0,
        name: a.symbol,
      }))
    } catch {
      // No fallback available
    }
  }

  const [coinMap, foundersLookup] = await Promise.all([
    loadCoinMap(),
    loadFoundersLookup(),
  ])

  const enrichedHoldings: EnrichedHolding[] = rawHoldings.map(h => {
    const coin = coinMap[h.symbol]
    return {
      ...h,
      image: coin?.image,
      coingecko_id: coin?.id,
    }
  })

  const cgIds = enrichedHoldings
    .map(h => h.coingecko_id)
    .filter((id): id is string => !!id)

  const [founderAgg, defiAgg, fundingAgg, cgMarketData] = await Promise.all([
    Promise.resolve(buildFounderAggregates(enrichedHoldings, foundersLookup || {})),
    fetchDefiData(enrichedHoldings),
    fetchFundingData(enrichedHoldings),
    fetchCoinGeckoMarketData([...new Set(cgIds)]),
  ])

  for (const h of enrichedHoldings) {
    if (h.coingecko_id && cgMarketData[h.coingecko_id]) {
      const md = cgMarketData[h.coingecko_id]
      if (h.price === 0 && md.usd) h.price = md.usd
      h.market_cap = md.usd_market_cap
      h.change_24h = md.usd_24h_change
    }
  }

  return {
    itpId,
    holdings: enrichedHoldings,
    founders: founderAgg,
    defi: defiAgg,
    funding: fundingAgg,
  }
}
