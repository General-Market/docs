import { DATA_NODE_URL, EXTRA_MORPHO_MARKETS, ADDR } from './config.js'
import { makePublic } from './clients.js'
import { MORPHO_ABI } from './abis.js'

export type Itp = { itpId: `0x${string}`; symbol: string; name: string; nav: number; aum: number }
export type MorphoMarket = {
  marketId: `0x${string}`
  collateralToken: `0x${string}`
  loanToken: `0x${string}`
  oracle: `0x${string}`
  irm: `0x${string}`
  lltv: bigint
  itpId?: `0x${string}`
}

let itpCache: { at: number; data: Itp[] } | null = null
let mktCache: { at: number; data: MorphoMarket[] } | null = null
const TTL_MS = 60 * 60 * 1000

export async function listItps(): Promise<Itp[]> {
  if (itpCache && Date.now() - itpCache.at < TTL_MS) return itpCache.data
  const r = await fetch(`${DATA_NODE_URL}/aum-ranking`)
  if (!r.ok) throw new Error(`aum-ranking ${r.status}`)
  const j = (await r.json()) as { snapshots: { itp_id: string; label: string; total_aum: string; computed_nav: string }[] }
  const data: Itp[] = j.snapshots.map((s) => ({
    itpId: s.itp_id as `0x${string}`,
    symbol: s.label.slice(0, 12),
    name: s.label,
    nav: Number(s.computed_nav) || 1,
    aum: Number(s.total_aum) || 0,
  }))
  itpCache = { at: Date.now(), data }
  return data
}

export async function listMorphoMarkets(): Promise<MorphoMarket[]> {
  if (mktCache && Date.now() - mktCache.at < TTL_MS) return mktCache.data
  const r = await fetch(`${DATA_NODE_URL}/morpho-markets`)
  if (!r.ok) throw new Error(`morpho-markets ${r.status}`)
  const raw = (await r.json()) as unknown
  // Accept either {markets:[...]} or [...] shape — be tolerant.
  const arr = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : ((raw as { markets?: Record<string, unknown>[] }).markets ?? [])
  const sseMarkets: MorphoMarket[] = arr
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      marketId: String(m.marketId ?? m.market_id ?? '0x') as `0x${string}`,
      collateralToken: String(m.collateralToken ?? m.collateral_token ?? '0x') as `0x${string}`,
      loanToken: String(m.loanToken ?? m.loan_token ?? '0x') as `0x${string}`,
      oracle: String(m.oracle ?? '0x') as `0x${string}`,
      irm: String(m.irm ?? '0x') as `0x${string}`,
      lltv: BigInt(String(m.lltv ?? '0')),
      itpId: m.itpId || m.itp_id ? (String(m.itpId ?? m.itp_id) as `0x${string}`) : undefined,
    }))
    .filter((m) => m.marketId !== '0x' && m.collateralToken !== '0x')

  // Merge in any EXTRA markets passed via env. Reads marketParams from chain
  // so the bot doesn't need them hard-coded — only the marketId.
  const extra: MorphoMarket[] = []
  if (EXTRA_MORPHO_MARKETS.length > 0) {
    const pub = makePublic()
    for (const marketId of EXTRA_MORPHO_MARKETS) {
      try {
        const res = (await pub.readContract({
          address: ADDR.Morpho,
          abi: MORPHO_ABI,
          functionName: 'idToMarketParams',
          args: [marketId],
        })) as readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint]
        if (res[4] === 0n) continue // not registered
        extra.push({
          marketId,
          loanToken: res[0].toLowerCase() as `0x${string}`,
          collateralToken: res[1].toLowerCase() as `0x${string}`,
          oracle: res[2].toLowerCase() as `0x${string}`,
          irm: res[3].toLowerCase() as `0x${string}`,
          lltv: res[4],
        })
      } catch {
        // skip silently — Morpho reverts mean market doesn't exist on this address
      }
    }
  }

  // De-dup by marketId (extra wins over SSE if both contain the same id)
  const byId = new Map<string, MorphoMarket>()
  for (const m of sseMarkets) byId.set(m.marketId, m)
  for (const m of extra) byId.set(m.marketId, m)
  const data = Array.from(byId.values())

  mktCache = { at: Date.now(), data }
  return data
}

export function pickOne<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('empty pick')
  return arr[Math.floor(Math.random() * arr.length)]!
}
