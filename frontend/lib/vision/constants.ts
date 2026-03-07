/**
 * Vision dual-balance architecture constants.
 *
 * L3 USDC uses 18 decimals (standard for Index L3 chain).
 * Settlement USDC uses 6 decimals (standard bridged USDC on Settlement).
 */

/** USDC decimals on L3 (Vision.sol chain) */
export const VISION_USDC_DECIMALS = 18

/** USDC decimals on Settlement */
export const SETTLEMENT_USDC_DECIMALS = 6

/** Vision contract address (L3) */
export const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** SettlementBridgeCustody contract address (Settlement) */
export const SETTLEMENT_BRIDGE_CUSTODY_ADDRESS = (
  process.env.NEXT_PUBLIC_SETTLEMENT_BRIDGE_CUSTODY_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Settlement USDC address */
export const SETTLEMENT_USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_SETTLEMENT_USDC_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Settlement chain ID */
export const SETTLEMENT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_ID) || 421611337

/** Low gas threshold for L3 (GM native token) — 0.001 GM */
export const LOW_GAS_THRESHOLD = 1_000_000_000_000_000n // 0.001 ether in wei
