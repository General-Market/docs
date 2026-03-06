/**
 * Vision dual-balance architecture constants.
 *
 * L3 USDC uses 18 decimals (standard for Index L3 chain).
 * Arbitrum USDC uses 6 decimals (standard bridged USDC on Arb).
 */

/** USDC decimals on L3 (Vision.sol chain) */
export const VISION_USDC_DECIMALS = 18

/** USDC decimals on Arbitrum */
export const ARB_USDC_DECIMALS = 6

/** Vision contract address (L3) */
export const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** ArbBridgeCustody contract address (Arbitrum) */
export const ARB_BRIDGE_CUSTODY_ADDRESS = (
  process.env.NEXT_PUBLIC_ARB_BRIDGE_CUSTODY_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Arbitrum USDC address */
export const ARB_USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_ARB_USDC_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Arbitrum chain ID */
export const ARB_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARB_CHAIN_ID) || 421611337

/** Low gas threshold for L3 (GM native token) — 0.001 GM */
export const LOW_GAS_THRESHOLD = 1_000_000_000_000_000n // 0.001 ether in wei
