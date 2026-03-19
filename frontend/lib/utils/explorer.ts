/**
 * Block Explorer URL utilities for Index L3 (Orbit) and Settlement (Sonic)
 *
 * All explorer links go through these functions — never construct URLs manually.
 * L3: Blockscout on VPS 2 (GET requests to same host as RPC)
 * Settlement: Sonic testnet explorer (sonicscan.org)
 */

import { L3_EXPLORER_URL, SETTLEMENT_EXPLORER_URL } from '@/lib/config'

export type ExplorerChain = 'settlement' | 'l3'

function explorerBase(chain: ExplorerChain): string {
  return chain === 'settlement' ? SETTLEMENT_EXPLORER_URL : L3_EXPLORER_URL
}

export function getTxUrl(txHash: string, chain: ExplorerChain = 'l3'): string {
  const base = explorerBase(chain)
  return base ? `${base}/tx/${txHash}` : '#'
}

export function getAddressUrl(address: string, chain: ExplorerChain = 'l3'): string {
  const base = explorerBase(chain)
  return base ? `${base}/address/${address}` : '#'
}

export function getContractUrl(address: string, chain: ExplorerChain = 'l3'): string {
  const base = explorerBase(chain)
  return base ? `${base}/address/${address}#code` : '#'
}

/**
 * Get the raw explorer base URL for a chain.
 * Use when you need the base URL directly (e.g. linking to the explorer homepage).
 */
export function getExplorerBaseUrl(chain: ExplorerChain = 'l3'): string {
  return explorerBase(chain)
}
