/**
 * Vision dual-balance architecture constants.
 *
 * L3 USDC uses 18 decimals (standard for Index L3 chain).
 * Settlement USDC uses 6 decimals (standard bridged USDC on Settlement).
 *
 * Address constants below are kept for backward compatibility with existing
 * synchronous consumers. New code should use useDeployment() (React) or
 * getDeploymentAddress() (async, non-React) from @/lib/contracts/addresses.
 */

import { getDeploymentAddress } from '@/lib/contracts/addresses'

/** USDC decimals on L3 (Vision.sol chain) */
export const VISION_USDC_DECIMALS = 18

/** USDC decimals on Settlement */
export const SETTLEMENT_USDC_DECIMALS = 6

/** Vision contract address (L3) — synchronous fallback for legacy consumers */
export const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** SettlementBridgeCustody contract address (Settlement) — synchronous fallback */
export const SETTLEMENT_BRIDGE_CUSTODY_ADDRESS = (
  process.env.NEXT_PUBLIC_SETTLEMENT_BRIDGE_CUSTODY_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Settlement USDC address — synchronous fallback */
export const SETTLEMENT_USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_SETTLEMENT_USDC_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Settlement chain ID */
export const SETTLEMENT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_ID) || 421611337

/** Low gas threshold for L3 (GM native token) — 0.05 GM, roughly one tx of buffer */
export const LOW_GAS_THRESHOLD = 50_000_000_000_000_000n // 0.05 ether in wei

// ---------------------------------------------------------------------------
// Runtime address getters (async) — for non-React contexts migrating away
// from NEXT_PUBLIC_* env vars. Returns the address from /api/deployment.
// ---------------------------------------------------------------------------

/** Vision contract address via runtime API */
export async function getVisionAddress(): Promise<`0x${string}`> {
  const addr = await getDeploymentAddress('Vision')
  return (addr ?? VISION_ADDRESS) as `0x${string}`
}

/** SettlementBridgeCustody address via runtime API */
export async function getSettlementBridgeCustodyAddress(): Promise<`0x${string}`> {
  const addr = await getDeploymentAddress('SettlementBridgeCustody')
  return (addr ?? SETTLEMENT_BRIDGE_CUSTODY_ADDRESS) as `0x${string}`
}

/** Settlement USDC address via runtime API */
export async function getSettlementUsdcAddress(): Promise<`0x${string}`> {
  const addr = await getDeploymentAddress('SETTLEMENT_USDC')
  return (addr ?? SETTLEMENT_USDC_ADDRESS) as `0x${string}`
}
