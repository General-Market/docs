/**
 * Contract addresses for the Index protocol
 * Loaded directly from deployment JSON (single source of truth).
 * File is copied from deployments/active-deployment.json by start.sh step 6.
 */
import deployment from './deployment.json'

const c = deployment.contracts

// Index Protocol Contracts
export const INDEX_PROTOCOL = {
  index: c.Index as `0x${string}`,
  bridgeProxy: c.BridgeProxy as `0x${string}`,
  bridgedItpFactory: c.BridgedItpFactory as `0x${string}`,
  issuerRegistry: c.IssuerRegistry as `0x${string}`,
  assetPairRegistry: c.CollateralRegistry as `0x${string}`,
  mockBitgetVault: c.MockBitgetVault as `0x${string}`,
  arbCustody: c.ArbBridgeCustody as `0x${string}`,
  arbUsdc: c.ARB_USDC as `0x${string}`,
  l3Usdc: c.L3_WUSDC as `0x${string}`,
  feeRegistry: '' as `0x${string}`,
}

// Morpho / Lending references (read via backend, addresses for frontend reference)
export const BRIDGE_PROXY = c.BridgeProxy as `0x${string}`

// Chain config
export const CHAIN_ID = deployment.chainId

// Legacy / AgiArena compat (unused but other files import these)
export const CONTRACT_ADDRESS = c.Index as `0x${string}`
export const RESOLUTION_CONTRACT_ADDRESS = (c as any).Governance as `0x${string}` || '' as `0x${string}`
export const COLLATERAL_TOKEN_ADDRESS = c.L3_WUSDC as `0x${string}`
export const COLLATERAL_SYMBOL: string = 'WIND'
export const COLLATERAL_DECIMALS = 18
export const MIN_BET_AMOUNT = BigInt(10 ** (COLLATERAL_DECIMALS - 2))
export const BACKEND_URL = ''

// Legacy exports
export const BASE_CHAIN_ID = CHAIN_ID
export const USDC_ADDRESS = COLLATERAL_TOKEN_ADDRESS
export const USDC_DECIMALS = COLLATERAL_DECIMALS

export function getContractAddress(): `0x${string}` { return CONTRACT_ADDRESS }
export function getResolutionContractAddress(): `0x${string}` { return RESOLUTION_CONTRACT_ADDRESS }
export function getBackendUrl(): string { return BACKEND_URL }

interface NetworkConfig {
  chainId: number
  chainName: string
  contracts: { agiArenaCore: `0x${string}`; resolutionDAO: `0x${string}` }
  collateralToken: { address: `0x${string}`; symbol: string; decimals: number }
  rpcUrl: string
}

const activeNetwork: NetworkConfig = {
  chainId: CHAIN_ID,
  chainName: 'Index L3',
  contracts: { agiArenaCore: CONTRACT_ADDRESS, resolutionDAO: RESOLUTION_CONTRACT_ADDRESS },
  collateralToken: { address: COLLATERAL_TOKEN_ADDRESS, symbol: COLLATERAL_SYMBOL, decimals: COLLATERAL_DECIMALS },
  rpcUrl: process.env.NEXT_PUBLIC_L3_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545',
}

export function getActiveNetwork(): NetworkConfig { return activeNetwork }
export function getNetworks(): Record<string, NetworkConfig> { return { 'index-l3': activeNetwork } }

export function formatCollateralAmount(amount: bigint | number): string {
  const value = typeof amount === 'bigint' ? Number(amount) : amount
  const displayValue = value / (10 ** COLLATERAL_DECIMALS)
  return displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function parseCollateralAmount(displayAmount: number | string): bigint {
  const value = typeof displayAmount === 'string' ? parseFloat(displayAmount) : displayAmount
  return BigInt(Math.floor(value * (10 ** COLLATERAL_DECIMALS)))
}
