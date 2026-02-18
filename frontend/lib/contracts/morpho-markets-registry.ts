/**
 * Morpho Markets Registry
 *
 * Maps ITP collateral token addresses to their Morpho market params.
 * Loads from morpho-deployment.json (singleton) and batch-markets.json (multi-market).
 */
import morphoDeployment from './morpho-deployment.json'

const c = morphoDeployment.contracts as Record<string, string>
const mp = morphoDeployment.marketParams

export interface MorphoMarketEntry {
  marketId: `0x${string}`
  loanToken: `0x${string}`
  collateralToken: `0x${string}`
  oracle: `0x${string}`
  irm: `0x${string}`
  lltv: bigint
  morpho: `0x${string}`
  vault: `0x${string}`
}

/**
 * Batch market entry shape from batch-markets.json (output of DeployBatchMarkets.s.sol)
 */
interface BatchMarketJson {
  collateralToken: string
  oracle: string
  marketId: string
  lltv: string
  loanToken: string
  irm: string
}

interface BatchDeploymentJson {
  infrastructure: {
    MORPHO: string
    CURATOR_RATE_IRM: string
    METAMORPHO_VAULT: string
    ARB_USDC: string
    MIRROR_REGISTRY: string
  }
  markets: BatchMarketJson[]
}

/**
 * Registry of all Morpho markets keyed by collateral token address (lowercased).
 *
 * Starts with the singleton market from morpho-deployment.json.
 * Batch markets from batch-markets.json are merged in at module load time.
 */
const MARKETS: Record<string, MorphoMarketEntry> = {
  [mp.collateralToken.toLowerCase()]: {
    marketId: c.MARKET_ID as `0x${string}`,
    loanToken: mp.loanToken as `0x${string}`,
    collateralToken: mp.collateralToken as `0x${string}`,
    oracle: mp.oracle as `0x${string}`,
    irm: mp.irm as `0x${string}`,
    lltv: BigInt(mp.lltv),
    morpho: c.MORPHO as `0x${string}`,
    vault: c.METAMORPHO_VAULT as `0x${string}`,
  },
}

// Load batch markets if available (optional file, won't break if missing)
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const batchData = require('./batch-markets.json') as BatchDeploymentJson
  if (batchData?.markets?.length) {
    const infra = batchData.infrastructure
    for (const m of batchData.markets) {
      const key = m.collateralToken.toLowerCase()
      if (!MARKETS[key]) {
        MARKETS[key] = {
          marketId: m.marketId as `0x${string}`,
          loanToken: m.loanToken as `0x${string}`,
          collateralToken: m.collateralToken as `0x${string}`,
          oracle: m.oracle as `0x${string}`,
          irm: m.irm as `0x${string}`,
          lltv: BigInt(m.lltv),
          morpho: infra.MORPHO as `0x${string}`,
          vault: infra.METAMORPHO_VAULT as `0x${string}`,
        }
      }
    }
  }
} catch {
  // batch-markets.json not present — only singleton market available
}

/**
 * Look up the Morpho market for a given ITP collateral token address.
 */
export function getMorphoMarketForItp(collateralTokenAddress: string | undefined): MorphoMarketEntry | null {
  if (!collateralTokenAddress) return null
  return MARKETS[collateralTokenAddress.toLowerCase()] ?? null
}

/**
 * Check whether a lending market exists for a given ITP collateral token.
 */
export function hasLendingMarket(collateralTokenAddress: string | undefined): boolean {
  return getMorphoMarketForItp(collateralTokenAddress) !== null
}

/**
 * Get all registered Morpho markets.
 */
export function getAllMorphoMarkets(): MorphoMarketEntry[] {
  return Object.values(MARKETS)
}
