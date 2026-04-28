/**
 * Contract addresses for the Index protocol
 * Loaded directly from deployment JSON (single source of truth).
 * File is copied from deployments/active-deployment.json by start.sh step 6.
 */
import deployment from './deployment.json'

// Deployment JSONs are written by forge scripts and shell tools that don't
// always emit EIP-55 checksums correctly. viem v2 rejects mis-cased addresses
// at the contract-call boundary ("Address must match its checksum counterpart").
// Lowercasing is unconditionally accepted by viem — no checksum check applies.
// Normalize once at the import boundary so every consumer is safe.
const lc = (a: string | undefined): `0x${string}` =>
  (a ? a.toLowerCase() : '0x0000000000000000000000000000000000000000') as `0x${string}`

const c = deployment.contracts

// Index Protocol Contracts
export const INDEX_PROTOCOL = {
  index: lc(c.Index),
  bridgeProxy: lc(c.BridgeProxy),
  bridgedItpFactory: lc(c.BridgedItpFactory),
  settlementBridgedItpFactory: lc((c as any).SettlementBridgedItpFactory),
  issuerRegistry: lc((c as any).IssuerRegistry ?? c.OracleRegistry),
  assetPairRegistry: lc(c.CollateralRegistry),
  mockBitgetVault: lc(c.MockBitgetVault),
  settlementBridgeProxy: lc((c as any).SettlementBridgeProxy),
  settlementCustody: lc(c.SettlementBridgeCustody),
  settlementUsdc: lc(c.SETTLEMENT_USDC),
  l3Usdc: lc(c.L3_WUSDC),
  feeRegistry: '' as `0x${string}`,
}

// Morpho / Lending references (read via backend, addresses for frontend reference)
export const BRIDGE_PROXY = lc(c.BridgeProxy)

// Chain config
export const CHAIN_ID = (deployment as any).chainId ?? 111222333

// Legacy / General Market compat (unused but other files import these)
export const CONTRACT_ADDRESS = lc(c.Index)
export const COLLATERAL_TOKEN_ADDRESS = lc(c.L3_WUSDC)
export const COLLATERAL_SYMBOL: string = 'USDC'
export const COLLATERAL_DECIMALS = 18
export const MIN_BET_AMOUNT = BigInt(10 ** (COLLATERAL_DECIMALS - 2))
export const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/backend'                                          // Client: through catch-all proxy
  : (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001')  // Server: direct

// Legacy exports
export const USDC_ADDRESS = COLLATERAL_TOKEN_ADDRESS
export const USDC_DECIMALS = COLLATERAL_DECIMALS

export function getContractAddress(): `0x${string}` { return CONTRACT_ADDRESS }
export function getBackendUrl(): string {
  if (typeof window !== 'undefined') return '/api/backend'
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
}

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
// deploy trigger 1774809567
