/**
 * Contract addresses for the Index protocol
 * Loaded directly from deployment JSON (single source of truth).
 * File is copied from deployments/active-deployment.json by start.sh step 6.
 */
import { L3_RPC_URL } from '../config'
import deployment from './deployment.json'

const c = deployment.contracts

// Index Protocol Contracts
export const INDEX_PROTOCOL = {
  index: c.Index as `0x${string}`,
  bridgeProxy: c.BridgeProxy as `0x${string}`,
  bridgedItpFactory: c.BridgedItpFactory as `0x${string}`,
  issuerRegistry: (c as any).IssuerRegistry as `0x${string}` ?? c.OracleRegistry as `0x${string}`,
  assetPairRegistry: c.CollateralRegistry as `0x${string}`,
  mockBitgetVault: c.MockBitgetVault as `0x${string}`,
  settlementCustody: c.SettlementBridgeCustody as `0x${string}`,
  settlementUsdc: c.SETTLEMENT_USDC as `0x${string}`,
  l3Usdc: c.L3_WUSDC as `0x${string}`,
  feeRegistry: '' as `0x${string}`,
}

// Morpho / Lending references (read via backend, addresses for frontend reference)
export const BRIDGE_PROXY = c.BridgeProxy as `0x${string}`

// Chain config
export const CHAIN_ID = deployment.chainId

// Legacy / General Market compat (unused but other files import these)
export const CONTRACT_ADDRESS = c.Index as `0x${string}`
export const RESOLUTION_CONTRACT_ADDRESS = (c as any).Governance as `0x${string}` || '' as `0x${string}`
export const COLLATERAL_TOKEN_ADDRESS = c.L3_WUSDC as `0x${string}`
export const COLLATERAL_SYMBOL: string = 'USDC'
export const COLLATERAL_DECIMALS = 18
export const MIN_BET_AMOUNT = BigInt(10 ** (COLLATERAL_DECIMALS - 2))
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
if (typeof window !== 'undefined' && !BACKEND_URL) {
  console.warn('[addresses] NEXT_PUBLIC_BACKEND_URL is empty — SSE and backend API calls will fail')
}

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
  rpcUrl: L3_RPC_URL,
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

// ---------------------------------------------------------------------------
// Runtime deployment address utility (non-React contexts: constants, E2E, etc.)
// ---------------------------------------------------------------------------

let _deploymentCache: Record<string, string> | null = null

/**
 * Fetch a contract address from the runtime deployment API.
 * For use in module-level code, E2E helpers, server utilities — anywhere
 * React hooks are illegal.
 *
 * Handles the IssuerRegistry → OracleRegistry rename automatically.
 * Results are cached in-memory after the first fetch.
 */
export async function getDeploymentAddress(name: string): Promise<string | null> {
  if (!_deploymentCache) {
    try {
      const res = await fetch('/api/deployment')
      if (res.ok) {
        const data = await res.json()
        _deploymentCache = data.contracts ?? {}
      } else {
        return null
      }
    } catch {
      return null
    }
  }
  return _deploymentCache?.[name]
    ?? (name === 'IssuerRegistry' ? _deploymentCache?.['OracleRegistry'] ?? null : null)
}
