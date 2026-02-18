/**
 * TypeScript types for Morpho Protocol
 *
 * Based on:
 * - Morpho Blue structs (contracts/lib/morpho-blue/src/interfaces/IMorpho.sol)
 * - ITPNAVOracle (contracts/src/oracle/ITPNAVOracle.sol)
 */

/**
 * Market parameters for a Morpho market
 */
export interface MarketParams {
  loanToken: `0x${string}`
  collateralToken: `0x${string}`
  oracle: `0x${string}`
  irm: `0x${string}`
  lltv: bigint
}

/**
 * Market ID is a bytes32 hash of market parameters
 */
export type MarketId = `0x${string}`

/**
 * User position in a Morpho market
 */
export interface Position {
  /** Supply shares (for lenders, not used in borrowing flow) */
  supplyShares: bigint
  /** Borrow shares (debt denominated in shares) */
  borrowShares: bigint
  /** Collateral amount (ITP tokens deposited) */
  collateral: bigint
}

/**
 * Market state from Morpho contract
 */
export interface MarketState {
  /** Total assets supplied to the market */
  totalSupplyAssets: bigint
  /** Total supply shares minted */
  totalSupplyShares: bigint
  /** Total assets borrowed from the market */
  totalBorrowAssets: bigint
  /** Total borrow shares minted */
  totalBorrowShares: bigint
  /** Last interest accrual timestamp */
  lastUpdate: bigint
  /** Protocol fee (in WAD, 1e18 = 100%) */
  fee: bigint
}

/**
 * Computed market info for display
 */
export interface MarketInfo {
  /** Market parameters */
  params: MarketParams
  /** Market ID (bytes32) */
  marketId: MarketId
  /** Current NAV price from oracle (36 decimals) */
  navPrice: bigint
  /** LLTV as a percentage (e.g., 77 for 77%) */
  lltvPercent: number
  /** Current utilization rate (0-100) */
  utilization: number
  /** Current borrow APY (annualized, in percent) */
  borrowApy: number
  /** Total borrowed (USDC, 6 decimals) */
  totalBorrowed: bigint
  /** Total collateral (ITP, 18 decimals) */
  totalCollateral: bigint
}

/**
 * User's lending/borrowing position
 */
export interface UserPosition {
  /** Collateral deposited (ITP, 18 decimals) */
  collateralAmount: bigint
  /** Debt owed (USDC, 6 decimals) */
  debtAmount: bigint
  /** Health factor (1.0 = at liquidation threshold) */
  healthFactor: number
  /** Liquidation price (USDC per ITP, display format) */
  liquidationPrice: number
  /** Maximum borrowable (USDC, 6 decimals) */
  maxBorrow: bigint
  /** Available to withdraw without liquidation (ITP, 18 decimals) */
  maxWithdraw: bigint
}

/**
 * MetaMorpho vault info
 */
export interface VaultInfo {
  /** Vault address */
  address: `0x${string}`
  /** Vault name */
  name: string
  /** Vault symbol */
  symbol: string
  /** Total assets in vault (USDC, 6 decimals) */
  totalAssets: bigint
  /** Current APY for depositors */
  apy: number
  /** Utilization rate (0-100) */
  utilization: number
  /** Vault share token decimals (typically 18 for ERC4626) */
  decimals: number
}

/**
 * User's vault position
 */
export interface VaultPosition {
  /** Vault shares owned */
  shares: bigint
  /** Current value in USDC (6 decimals) */
  value: bigint
}

/**
 * Oracle price info
 */
export interface OracleInfo {
  /** Current price (36 decimals, Morpho format) */
  price: bigint
  /** Last update timestamp */
  lastUpdated: bigint
  /** Last cycle number */
  lastCycleNumber: bigint
  /** Whether the price is stale (> 24 hours old) */
  isStale: boolean
}

/**
 * Constants for Morpho calculations
 * Note: Use string construction for large BigInts to avoid JavaScript precision loss
 */
export const MORPHO_CONSTANTS = {
  /** WAD (1e18) - used for percentage calculations */
  WAD: BigInt('1000000000000000000'), // 1e18
  /** Price decimals (36 for Morpho oracles) */
  PRICE_DECIMALS: 36n,
  /** USDC decimals */
  USDC_DECIMALS: 6,
  /** ITP decimals */
  ITP_DECIMALS: 18,
  /** Maximum staleness for oracle (24 hours) */
  MAX_STALENESS: 24n * 60n * 60n,
  /** Seconds per year for APY calculations */
  SECONDS_PER_YEAR: 365n * 24n * 60n * 60n,
  /** 1e36 for oracle price calculations - use string to avoid precision loss */
  E36: BigInt('1' + '0'.repeat(36)),
  /** 1e48 for collateral value calculations - use string to avoid precision loss */
  E48: BigInt('1' + '0'.repeat(48)),
}

/**
 * Calculate health factor from position and oracle price
 *
 * Health factor = (collateralValue * LLTV) / debt
 * Morpho oracle convention: raw_collateral * price / ORACLE_PRICE_SCALE(1e36) = raw_loan
 * The oracle price encodes the decimal difference between collateral and loan tokens.
 *
 * @param collateralAmount - Collateral in ITP (18 decimals)
 * @param oraclePrice - Oracle price (Morpho ORACLE_PRICE_SCALE, encodes token decimal diff)
 * @param debtAmount - Debt in USDC (6 decimals)
 * @param lltv - LLTV in WAD (18 decimals, e.g., 0.77e18 for 77%)
 * @returns Health factor as a number (1.0 = at liquidation threshold)
 */
export function calculateHealthFactor(
  collateralAmount: bigint,
  oraclePrice: bigint,
  debtAmount: bigint,
  lltv: bigint
): number {
  if (debtAmount === 0n) {
    return Infinity
  }

  // collateralValue in USDC (6 decimals)
  // Morpho oracle convention: collateral_raw * price / ORACLE_PRICE_SCALE = loan_raw
  // The oracle price already accounts for decimal differences between tokens.
  const collateralValueE6 = (collateralAmount * oraclePrice) / MORPHO_CONSTANTS.E36

  // maxBorrow = collateralValue * LLTV / 1e18
  const maxBorrowE6 = (collateralValueE6 * lltv) / MORPHO_CONSTANTS.WAD

  return Number(maxBorrowE6) / Number(debtAmount)
}

/**
 * Calculate liquidation price from position
 *
 * Liquidation occurs when health factor = 1.0
 * Morpho formula: debt_raw = collateral_raw * price / 1e36 * LLTV / 1e18
 * Solving for price: price = debt * 1e36 * 1e18 / (collateral * LLTV)
 * Then convert from Morpho price (1e24 scale for ITP/USDC) to display USD.
 *
 * @param collateralAmount - Collateral in ITP (18 decimals)
 * @param debtAmount - Debt in USDC (6 decimals)
 * @param lltv - LLTV in WAD (18 decimals)
 * @returns Liquidation price in USDC per ITP (display format)
 */
export function calculateLiquidationPrice(
  collateralAmount: bigint,
  debtAmount: bigint,
  lltv: bigint
): number {
  if (collateralAmount === 0n) {
    return 0
  }

  // Morpho: debt_raw = collateral_raw * price / 1e36 * LLTV / 1e18
  // Solving: price = debt * 1e36 * 1e18 / (collateral * LLTV)
  // We compute in steps to avoid overflow, then convert to display USD.
  // priceRaw = debt * 1e48 * 1e18 / (collateral * LLTV)
  const debtScaled = debtAmount * MORPHO_CONSTANTS.E48
  const priceRaw = (debtScaled * MORPHO_CONSTANTS.WAD) / (collateralAmount * lltv)

  // priceRaw is in Morpho oracle scale; for ITP(18)/USDC(6): divide by 1e24
  // But the formula above produces 1e36 scale, so divide by 1e36 for display
  return Number(priceRaw) / Number(MORPHO_CONSTANTS.E36)
}

/**
 * Calculate utilization rate
 *
 * @param totalBorrowed - Total borrowed assets
 * @param totalSupply - Total supplied assets
 * @returns Utilization as percentage (0-100)
 */
export function calculateUtilization(
  totalBorrowed: bigint,
  totalSupply: bigint
): number {
  if (totalSupply === 0n) {
    return 0
  }
  return (Number(totalBorrowed) / Number(totalSupply)) * 100
}

/**
 * Convert borrow rate to APY
 *
 * @param borrowRatePerSecond - Borrow rate per second (WAD format)
 * @returns APY as percentage
 */
export function borrowRateToApy(borrowRatePerSecond: bigint): number {
  // APY = (1 + rate/1e18)^secondsPerYear - 1
  const ratePerSecond = Number(borrowRatePerSecond) / 1e18
  const apy = Math.pow(1 + ratePerSecond, Number(MORPHO_CONSTANTS.SECONDS_PER_YEAR)) - 1
  return apy * 100
}

/**
 * Format oracle price for display
 *
 * Morpho oracle convention: raw_collateral * price / 1e36 = raw_loan
 * For ITP(18dec)/USDC(6dec): price = USD_per_ITP * 10^(36 + 6 - 18) = USD_per_ITP * 10^24
 *
 * @param price36Decimals - Raw oracle price
 * @returns Price in USD
 */
export function formatOraclePrice(price36Decimals: bigint): number {
  return Number(price36Decimals) / 1e24
}
