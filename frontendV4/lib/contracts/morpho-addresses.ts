/**
 * Morpho Protocol contract addresses
 * Loaded directly from morpho-deployment.json (single source of truth).
 */
import morphoDeployment from './morpho-deployment.json'

const c = morphoDeployment.contracts as Record<string, string>
const mp = morphoDeployment.marketParams

export const MORPHO_ADDRESSES = {
  morpho: c.MORPHO as `0x${string}`,
  metaMorphoVault: c.METAMORPHO_VAULT as `0x${string}`,
  itpOracle: c.MOCK_ORACLE as `0x${string}`,
  adaptiveIrm: c.ADAPTIVE_IRM as `0x${string}`,
  curatorRateIrm: (c.CURATOR_RATE_IRM ?? c.ADAPTIVE_IRM) as `0x${string}`,
  morphoBundler: (c.MORPHO_BUNDLER ?? c.MORPHO) as `0x${string}`,
  marketId: c.MARKET_ID as `0x${string}`,
  loanToken: mp.loanToken as `0x${string}`,
  collateralToken: mp.collateralToken as `0x${string}`,
  lltv: BigInt(mp.lltv),
}

/**
 * Market parameters structure matching Morpho's MarketParams
 * Used for all Morpho contract interactions
 */
export interface MarketParams {
  loanToken: `0x${string}`
  collateralToken: `0x${string}`
  oracle: `0x${string}`
  irm: `0x${string}`
  lltv: bigint
}

/**
 * Get the default market parameters for ITP/USDC market
 */
export function getDefaultMarketParams(): MarketParams {
  return {
    loanToken: MORPHO_ADDRESSES.loanToken,
    collateralToken: MORPHO_ADDRESSES.collateralToken,
    oracle: MORPHO_ADDRESSES.itpOracle,
    irm: MORPHO_ADDRESSES.adaptiveIrm,
    lltv: MORPHO_ADDRESSES.lltv,
  }
}

/**
 * Convert market params to tuple for contract calls
 */
export function marketParamsToTuple(params: MarketParams): readonly [
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  bigint
] {
  return [
    params.loanToken,
    params.collateralToken,
    params.oracle,
    params.irm,
    params.lltv,
  ] as const
}
